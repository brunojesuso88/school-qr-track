/**
 * Cálculo do IRA (Índice de Rendimento Acadêmico).
 *
 * Fórmula: IRA = Σ(nota × peso) / Σ(peso)
 * Peso automático = carga semanal quando ela é 1, 2 ou 4 aulas.
 * Disciplina selecionada sem nota lançada no período escolhido entra com 0,00
 * (sinalizada como "nota não lançada"), sem alterar a nota original do boletim.
 * Cargas diferentes (3, 5, 6...) são inelegíveis até o administrador
 * definir explicitamente um "peso personalizado".
 *
 * Função pura e determinística: mesmas entradas => mesmo resultado.
 */

export const AUTO_WEIGHTS = [1, 2, 4] as const;

export type IraStatus = 'ok' | 'no_subjects' | 'no_grades' | 'not_configured';

/** Origem do valor usado no cálculo. */
export type IraValueSource = 'reported' | 'missing_as_zero';

export interface IraSubjectInput {
  subjectId: string;
  name: string;
  /** Carga semanal (mapping_class_subjects.weekly_classes ou snapshot). */
  weeklyClasses: number | null;
  includeInIra: boolean;
  /** Peso definido manualmente pelo administrador (carga fora de 1/2/4). */
  customWeight: number | null;
  /** Nota do período configurado para o IRA (null = não informada). */
  value: number | null;
  /** Texto original da célula (só para exibição/diagnóstico). */
  rawText?: string | null;
}

export interface IraLine {
  subjectId: string;
  name: string;
  weeklyClasses: number | null;
  weight: number | null;
  weightSource: 'auto' | 'custom' | 'none';
  value: number | null;
  /** Valor efetivamente usado no cálculo (0 quando a nota não foi lançada). */
  usedValue: number | null;
  valueSource: IraValueSource;
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
  /** Quantidade de disciplinas selecionadas sem nota lançada (contadas como 0,00). */
  missingGradeCount: number;
}

/** Peso automático a partir da carga semanal. `null` quando a carga não é 1, 2 ou 4. */
export function weightForWeeklyClasses(weeklyClasses: number | null | undefined): number | null {
  if (weeklyClasses == null) return null;
  return (AUTO_WEIGHTS as readonly number[]).includes(weeklyClasses) ? weeklyClasses : null;
}

export function isAutoWeightEligible(weeklyClasses: number | null | undefined): boolean {
  return weightForWeeklyClasses(weeklyClasses) !== null;
}

export function resolveWeight(subject: Pick<IraSubjectInput, 'weeklyClasses' | 'customWeight'>): {
  weight: number | null;
  source: 'auto' | 'custom' | 'none';
} {
  const auto = weightForWeeklyClasses(subject.weeklyClasses);
  if (auto !== null) return { weight: auto, source: 'auto' };
  if (subject.customWeight != null && subject.customWeight > 0) {
    return { weight: subject.customWeight, source: 'custom' };
  }
  return { weight: null, source: 'none' };
}

export interface CalculateIraOptions {
  /** Rótulo do período usado (só para mensagens). */
  periodLabel?: string | null;
  /** Se não houver período configurado, o IRA não é calculado. */
  hasPeriodConfigured?: boolean;
}

export function calculateIra(
  subjects: IraSubjectInput[],
  options: CalculateIraOptions = {},
): IraResult {
  const { periodLabel, hasPeriodConfigured = true } = options;

  const lines: IraLine[] = subjects.map((subject) => {
    const { weight, source } = resolveWeight(subject);
    let eligible = true;
    let reason: string | undefined;
    const reported = subject.value != null && !Number.isNaN(subject.value);
    const valueSource: IraValueSource = reported ? 'reported' : 'missing_as_zero';

    if (!subject.includeInIra) {
      eligible = false;
      reason = 'Disciplina não selecionada para o IRA';
    } else if (weight === null) {
      eligible = false;
      reason =
        subject.weeklyClasses == null
          ? 'Carga semanal não informada'
          : `Carga semanal ${subject.weeklyClasses} não segue a regra 1/2/4 — defina um peso personalizado`;
    }

    const usedValue = eligible ? (reported ? (subject.value as number) : 0) : null;
    const statusLabel = !subject.includeInIra
      ? 'Fora do IRA'
      : !eligible
        ? reason
        : reported
          ? `Nota registrada: ${formatGrade(subject.value)}`
          : 'Nota não lançada — considerada 0,00 no IRA';

    return {
      subjectId: subject.subjectId,
      name: subject.name,
      weeklyClasses: subject.weeklyClasses,
      weight,
      weightSource: source,
      value: subject.value,
      usedValue,
      valueSource,
      product: eligible && weight !== null && usedValue != null ? usedValue * weight : null,
      eligible,
      reason,
      statusLabel,
    };
  });

  const missingGradeCount = lines.filter(
    (l) => l.eligible && l.valueSource === 'missing_as_zero',
  ).length;

  if (!hasPeriodConfigured) {
    return {
      value: null,
      status: 'not_configured',
      reason: 'Período/nota usada no IRA ainda não foi definido na Configuração do IRA',
      totalWeight: 0,
      totalProduct: 0,
      lines,
      missingGradeCount: 0,
    };
  }

  const selected = subjects.filter((s) => s.includeInIra);
  if (selected.length === 0) {
    return {
      value: null,
      status: 'no_subjects',
      reason: 'Nenhuma disciplina foi marcada como participante do IRA',
      totalWeight: 0,
      totalProduct: 0,
      lines,
      missingGradeCount,
    };
  }

  const eligibleLines = lines.filter((l) => l.eligible && l.weight !== null && l.product !== null);
  const totalWeight = eligibleLines.reduce((sum, l) => sum + (l.weight as number), 0);
  const totalProduct = eligibleLines.reduce((sum, l) => sum + (l.product as number), 0);

  if (eligibleLines.length === 0 || totalWeight <= 0) {
    return {
      value: null,
      status: 'no_grades',
      reason: periodLabel
        ? `Nenhuma disciplina selecionada possui peso válido para o período (${periodLabel})`
        : 'Nenhuma disciplina selecionada possui peso válido',
      totalWeight,
      totalProduct,
      lines,
      missingGradeCount,
    };
  }

  return {
    value: totalProduct / totalWeight,
    status: 'ok',
    totalWeight,
    totalProduct,
    lines,
    missingGradeCount,
  };
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