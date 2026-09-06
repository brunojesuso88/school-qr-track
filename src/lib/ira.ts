/**
 * Cálculo do IRA (Índice de Rendimento Acadêmico) — motor único e multi-período.
 *
 * 1) Nota representativa da disciplina = média aritmética das notas dos
 *    períodos selecionados (1 ou mais). Nota ausente em um período selecionado
 *    entra como 0,00 APENAS no cálculo (o boletim continua com "—").
 * 2) IRA = Σ(nota_representativa × peso) / Σ(peso).
 *
 * ALGORITMO ÚNICO para TODAS as matrizes (Original, Integral, personalizadas):
 * o peso vem do PESO EXPLÍCITO do componente da matriz (`ira_weight`), nunca da
 * carga semanal. Padrões: Formação Geral Básica = 2 (Matemática e Língua
 * Portuguesa = 4) e Itinerários Formativos = 1 — todos editáveis.
 *
 * Sem peso configurado a disciplina fica PENDENTE: inelegível, fora do
 * denominador, e nunca gera NaN/Infinity. Quando a soma dos pesos é 0 o
 * resultado é determinístico: `value = null` com status `no_grades`.
 *
 * Função pura e determinística: mesmas entradas => mesmo resultado.
 */

export const AUTO_WEIGHTS = [1, 2, 4] as const;

export type IraStatus = 'ok' | 'no_subjects' | 'no_grades' | 'not_configured';

/** Rótulo único do algoritmo do IRA (não existe mais modo por matriz). */
export const IRA_MODE_LABEL =
  'IRA: média ponderada pelo PESO do componente (Formação Geral Básica 2 · Matemática e Língua Portuguesa 4 · Itinerários Formativos 1)';

/** Classificação obrigatória de todo componente curricular. */
export type IraClassification = 'fgb' | 'itinerario';

export const IRA_CLASSIFICATIONS: IraClassification[] = ['fgb', 'itinerario'];

export const IRA_CLASSIFICATION_LABEL: Record<IraClassification, string> = {
  fgb: 'Formação Geral Básica',
  itinerario: 'Itinerários Formativos',
};

export const IRA_CLASSIFICATION_SHORT: Record<IraClassification, string> = {
  fgb: 'FGB',
  itinerario: 'IF',
};

/** `true` quando o nome é Matemática ou Língua Portuguesa (exceções de peso 4 na FGB). */
export function isWeightFourSubject(name: string | null | undefined): boolean {
  const key = (name ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key) return false;
  if (/aprofundamento|itinerar|eletiva|trilha|tecnic|profission/.test(key)) return false;
  return /(^|\s)matematica(\s|$)/.test(key)
    || /lingua portuguesa/.test(key)
    || /(^|\s)portugues(\s|$)/.test(key);
}

/**
 * Peso PADRÃO do IRA a partir da classificação (regra oficial, sem exceção
 * fora da FGB): FGB = 2, exceto Matemática e Língua Portuguesa = 4;
 * Itinerários Formativos = 1 sempre.
 */
export function defaultIraWeight(
  classification: IraClassification,
  name?: string | null,
): number {
  if (classification !== 'fgb') return 1;
  return isWeightFourSubject(name) ? 4 : 2;
}

/** Classificação padrão sugerida a partir do nome do componente. */
export function suggestClassification(name: string | null | undefined): IraClassification {
  const key = (name ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/aprofundamento|projeto de vida|itinerar|eletiva|trilha|tecnic|profission|mundo do trabalho|estudo orientado|educacao digital|identidade e protagonismo|pratica|nucleo|empreendedor|robotica|informatica/.test(key)) {
    return 'itinerario';
  }
  if (/lingua portuguesa|portugues|redacao|literatura|matematica|fisica|quimica|biologia|historia|geografia|filosofia|sociologia|arte|educacao fisica|lingua inglesa|ingles|espanhol|ciencias da natureza|ciencias humanas|linguagens/.test(key)) {
    return 'fgb';
  }
  return 'itinerario';
}

/** `true` quando a carga semanal foi realmente informada (0 = não informada). */
export const hasWeeklyLoad = (weeklyClasses: number | null | undefined): boolean =>
  weeklyClasses != null && Number.isFinite(weeklyClasses) && weeklyClasses > 0;

/** Origem do valor usado no cálculo. */
export type IraValueSource = 'reported' | 'missing_as_zero';

/** Período selecionado para o cálculo. */
export interface IraPeriodRef {
  id: string;
  label: string;
}

export interface IraSubjectInput {
  subjectId: string;
  name: string;
  /** Carga semanal (metadado ACADÊMICO — não é mais fonte do peso do IRA). */
  weeklyClasses: number | null;
  /**
   * PESO EXPLÍCITO do componente no IRA (`ira_weight`). `null` = ainda não
   * configurado: a disciplina fica pendente e não entra no denominador.
   */
  iraWeight?: number | null;
  /** Classificação do componente, quando conhecida. */
  classification?: IraClassification | null;
  includeInIra: boolean;
  /** Peso definido manualmente pelo administrador (carga fora de 1/2/4). */
  customWeight: number | null;
  /** Nota por período (periodId -> nota; null/ausente = não informada). */
  valuesByPeriod: Record<string, number | null>;
}

/** Nota de um período selecionado, com o valor efetivamente usado. */
export interface IraPeriodValue {
  periodId: string;
  label: string;
  /** Nota real do boletim (null = não informada). */
  value: number | null;
  /** Valor usado no cálculo (0 quando não informada). */
  usedValue: number;
  missing: boolean;
}

export type IraWeightSource = 'matrix' | 'custom' | 'none';

export interface IraLine {
  subjectId: string;
  name: string;
  weeklyClasses: number | null;
  weight: number | null;
  weightSource: IraWeightSource;
  /** Notas dos períodos selecionados. */
  periodValues: IraPeriodValue[];
  /** Média aritmética dos períodos selecionados (nota representativa). */
  average: number | null;
  /** Alias de `average`, mantido para compatibilidade de exibição. */
  value: number | null;
  /** Valor efetivamente usado no cálculo (0 quando nenhuma nota foi lançada). */
  usedValue: number | null;
  valueSource: IraValueSource;
  /** Quantos períodos selecionados estavam sem nota (viraram 0,00). */
  missingPeriodCount: number;
  product: number | null;
  eligible: boolean;
  reason?: string;
  /** Rótulo curto de status para a interface. */
  statusLabel?: string;
}

export interface IraResult {
  value: number | null;
  status: IraStatus;
  reason?: string;
  totalWeight: number;
  totalProduct: number;
  lines: IraLine[];
  /** Períodos usados no cálculo, na ordem configurada. */
  selectedPeriods: IraPeriodRef[];
  /** Disciplinas selecionadas com pelo menos uma nota ausente (contadas como 0,00). */
  missingGradeCount: number;
  /** Nota representativa por disciplina (subjectId -> média). */
  periodAverages: Record<string, number | null>;
}

/**
 * Peso automático a partir da carga semanal. `null` quando a carga não é 1, 2 ou 4
 * (inclui 0, null e valores não finitos: carga "não informada").
 */
export function weightForWeeklyClasses(weeklyClasses: number | null | undefined): number | null {
  if (!hasWeeklyLoad(weeklyClasses)) return null;
  return (AUTO_WEIGHTS as readonly number[]).includes(weeklyClasses as number)
    ? (weeklyClasses as number)
    : null;
}

export function isAutoWeightEligible(weeklyClasses: number | null | undefined): boolean {
  return weightForWeeklyClasses(weeklyClasses) !== null;
}

/**
 * Peso da disciplina no IRA. Fonte ÚNICA: o peso explícito do componente
 * (`ira_weight`). Um peso personalizado da turma (`custom_ira_weight`) continua
 * podendo sobrescrevê-lo. A carga semanal NÃO define mais peso.
 */
export function resolveWeight(
  subject: Pick<IraSubjectInput, 'iraWeight' | 'customWeight'>,
): {
  weight: number | null;
  source: IraWeightSource;
} {
  const custom = subject.customWeight;
  if (custom != null && Number.isFinite(custom) && custom > 0) {
    return { weight: custom, source: 'custom' };
  }
  const explicit = subject.iraWeight;
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return { weight: explicit, source: 'matrix' };
  }
  return { weight: null, source: 'none' };
}

export interface CalculateIraOptions {
  /** Motivo específico quando não há configuração (mensagem exibida no card). */
  notConfiguredReason?: string;
}

/**
 * Motor ÚNICO do IRA (multi-período). Usado tanto no card do aluno quanto no
 * detalhe, garantindo valores idênticos.
 */
export function calculateIraMultiPeriod(
  subjects: IraSubjectInput[],
  selectedPeriods: IraPeriodRef[],
  options: CalculateIraOptions = {},
): IraResult {
  const periods = selectedPeriods ?? [];

  const lines: IraLine[] = subjects.map((subject) => {
    const { weight, source } = resolveWeight(subject);
    let eligible = true;
    let reason: string | undefined;

    if (!subject.includeInIra) {
      eligible = false;
      reason = 'Disciplina não selecionada para o IRA';
    } else if (weight === null) {
      eligible = false;
      reason = 'Peso do IRA não configurado — defina a classificação e o peso do componente na matriz curricular';
    }

    const periodValues: IraPeriodValue[] = periods.map((p) => {
      const raw = subject.valuesByPeriod?.[p.id];
      const reported = raw != null && !Number.isNaN(raw);
      return {
        periodId: p.id,
        label: p.label,
        value: reported ? (raw as number) : null,
        usedValue: reported ? (raw as number) : 0,
        missing: !reported,
      };
    });

    const missingPeriodCount = periodValues.filter((v) => v.missing).length;
    const average =
      periodValues.length > 0
        ? periodValues.reduce((sum, v) => sum + v.usedValue, 0) / periodValues.length
        : null;
    const anyReported = periodValues.some((v) => !v.missing);
    const valueSource: IraValueSource = anyReported ? 'reported' : 'missing_as_zero';
    const usedValue = eligible ? (average ?? null) : null;

    const statusLabel = !subject.includeInIra
      ? 'Fora do IRA'
      : !eligible
        ? reason
        : missingPeriodCount === 0
          ? `Média dos períodos: ${formatGrade(average)}`
          : missingPeriodCount === periodValues.length
            ? 'Nenhuma nota lançada — considerada 0,00 no IRA'
            : `${missingPeriodCount} período(s) sem nota — contados como 0,00`;

    return {
      subjectId: subject.subjectId,
      name: subject.name,
      weeklyClasses: subject.weeklyClasses,
      weight,
      weightSource: source,
      periodValues,
      average,
      value: average,
      usedValue,
      valueSource,
      missingPeriodCount,
      product: eligible && weight !== null && usedValue != null ? usedValue * weight : null,
      eligible,
      reason,
      statusLabel,
    };
  });

  const periodAverages: Record<string, number | null> = {};
  lines.forEach((l) => { periodAverages[l.subjectId] = l.average; });

  const missingGradeCount = lines.filter((l) => l.eligible && l.missingPeriodCount > 0).length;

  if (periods.length === 0) {
    return {
      value: null,
      status: 'not_configured',
      reason:
        options.notConfiguredReason ??
        'Períodos/nota usada no IRA ainda não foram definidos em Configurações → IRA',
      totalWeight: 0,
      totalProduct: 0,
      lines,
      selectedPeriods: periods,
      missingGradeCount: 0,
      periodAverages,
    };
  }

  if (subjects.filter((s) => s.includeInIra).length === 0) {
    return {
      value: null,
      status: 'no_subjects',
      reason: 'Nenhuma disciplina foi marcada como participante do IRA',
      totalWeight: 0,
      totalProduct: 0,
      lines,
      selectedPeriods: periods,
      missingGradeCount,
      periodAverages,
    };
  }

  const eligibleLines = lines.filter((l) => l.eligible && l.weight !== null && l.product !== null);
  const totalWeight = eligibleLines.reduce((sum, l) => sum + (l.weight as number), 0);
  const totalProduct = eligibleLines.reduce((sum, l) => sum + (l.product as number), 0);

  if (eligibleLines.length === 0 || totalWeight <= 0) {
    return {
      value: null,
      status: 'no_grades',
      reason: `Nenhuma disciplina selecionada possui peso válido para ${describePeriods(periods)}`,
      totalWeight,
      totalProduct,
      lines,
      selectedPeriods: periods,
      missingGradeCount,
      periodAverages,
    };
  }

  return {
    value: Number.isFinite(totalProduct / totalWeight) ? totalProduct / totalWeight : null,
    status: 'ok',
    totalWeight,
    totalProduct,
    lines,
    selectedPeriods: periods,
    missingGradeCount,
    periodAverages,
  };
}

/** "1º Período + 2º Período" ou "período não definido". */
export function describePeriods(periods: IraPeriodRef[] | null | undefined): string {
  if (!periods || periods.length === 0) return 'período não definido';
  return periods.map((p) => p.label).join(' + ');
}

/** Formata o IRA com 2 casas decimais (pt-BR) ou "—" quando indisponível. */
export function formatIra(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata uma nota com 2 casas ou "—". */
export function formatGrade(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}