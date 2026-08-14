/**
 * Cálculo do IRA (Índice de Rendimento Acadêmico).
 *
 * Fórmula: IRA = Σ(nota × peso) / Σ(peso)
 * Peso automático = carga semanal quando ela é 1, 2 ou 4 aulas.
 * Cargas diferentes (3, 5, 6...) são inelegíveis até o administrador
 * definir explicitamente um "peso personalizado".
 *
 * Função pura e determinística: mesmas entradas => mesmo resultado.
 */

export const AUTO_WEIGHTS = [1, 2, 4] as const;

export type IraStatus = 'ok' | 'no_subjects' | 'no_grades' | 'not_configured';

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
}

export interface IraLine {
  subjectId: string;
  name: string;
  weeklyClasses: number | null;
  weight: number | null;
  weightSource: 'auto' | 'custom' | 'none';
  value: number | null;
  product: number | null;
  eligible: boolean;
  reason?: string;
}

export interface IraResult {
  value: number | null;
  status: IraStatus;
  reason?: string;
  totalWeight: number;
  totalProduct: number;
  lines: IraLine[];
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

    if (!subject.includeInIra) {
      eligible = false;
      reason = 'Disciplina não selecionada para o IRA';
    } else if (weight === null) {
      eligible = false;
      reason =
        subject.weeklyClasses == null
          ? 'Carga semanal não informada'
          : `Carga semanal ${subject.weeklyClasses} não segue a regra 1/2/4 — defina um peso personalizado`;
    } else if (subject.value == null || Number.isNaN(subject.value)) {
      eligible = false;
      reason = periodLabel
        ? `Nota não disponível para o período selecionado (${periodLabel})`
        : 'Nota não disponível para o período selecionado';
    }

    return {
      subjectId: subject.subjectId,
      name: subject.name,
      weeklyClasses: subject.weeklyClasses,
      weight,
      weightSource: source,
      value: subject.value,
      product: eligible && weight !== null && subject.value != null ? subject.value * weight : null,
      eligible,
      reason,
    };
  });

  if (!hasPeriodConfigured) {
    return {
      value: null,
      status: 'not_configured',
      reason: 'Período/nota usada no IRA ainda não foi definido na Configuração do IRA',
      totalWeight: 0,
      totalProduct: 0,
      lines,
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
        ? `Nenhuma disciplina elegível possui nota válida no período selecionado (${periodLabel})`
        : 'Nenhuma disciplina elegível possui nota válida',
      totalWeight,
      totalProduct,
      lines,
    };
  }

  return {
    value: totalProduct / totalWeight,
    status: 'ok',
    totalWeight,
    totalProduct,
    lines,
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