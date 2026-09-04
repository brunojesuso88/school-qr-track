/**
 * Cálculo do IRA (Índice de Rendimento Acadêmico) — motor único e multi-período.
 *
 * 1) Nota representativa da disciplina = média aritmética das notas dos
 *    períodos selecionados (1 ou mais). Nota ausente em um período selecionado
 *    entra como 0,00 APENAS no cálculo (o boletim continua com "—").
 * 2) IRA = Σ(nota_representativa × peso) / Σ(peso).
 *
 * ALGORITMO ÚNICO para TODAS as matrizes (Original, Integral, personalizadas):
 * peso automático = carga semanal quando ela é 1, 2 ou 4 aulas. Cargas
 * diferentes (3, 5, 6...) são inelegíveis até o administrador definir
 * explicitamente um "peso personalizado".
 *
 * Carga semanal 0 (ou null) significa "não informada": a disciplina fica
 * inelegível, NÃO entra no denominador e nunca gera NaN/Infinity. Quando a soma
 * dos pesos é 0 o resultado é determinístico: `value = null` com status
 * `no_grades` (mesmo comportamento histórico da Matriz Original).
 *
 * Função pura e determinística: mesmas entradas => mesmo resultado.
 */

export const AUTO_WEIGHTS = [1, 2, 4] as const;

export type IraStatus = 'ok' | 'no_subjects' | 'no_grades' | 'not_configured';

/** Rótulo único do algoritmo do IRA (não existe mais modo por matriz). */
export const IRA_MODE_LABEL = 'IRA: média ponderada pela carga semanal (1/2/4)';

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
  /** Carga semanal (mapping_class_subjects.weekly_classes ou snapshot). */
  weeklyClasses: number | null;
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

export type IraWeightSource = 'auto' | 'custom' | 'none';

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

/** Peso da disciplina: carga 1/2/4, senão peso personalizado positivo, senão nenhum. */
export function resolveWeight(
  subject: Pick<IraSubjectInput, 'weeklyClasses' | 'customWeight'>,
): {
  weight: number | null;
  source: IraWeightSource;
} {
  const auto = weightForWeeklyClasses(subject.weeklyClasses);
  if (auto !== null) return { weight: auto, source: 'auto' };
  if (subject.customWeight != null && Number.isFinite(subject.customWeight) && subject.customWeight > 0) {
    return { weight: subject.customWeight, source: 'custom' };
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
      reason =
        !hasWeeklyLoad(subject.weeklyClasses)
          ? 'Carga semanal não informada — informe 1, 2 ou 4 aulas ou um peso personalizado'
          : `Carga semanal ${subject.weeklyClasses} não segue a regra 1/2/4 — defina um peso personalizado`;
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