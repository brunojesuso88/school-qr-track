/**
 * Lógica pura do cache (snapshot) de IRA e medalhas.
 *
 * Não calcula IRA: apenas decide elegibilidade, monta as linhas persistidas e
 * resolve o estado de exibição (nunca calculado / desatualizado / atualizado).
 */
import { IraResult } from '@/lib/ira';
import { StudentMedal } from '@/lib/medals/compute';

/** Situação persistida que representa aluno desistente hoje (`students.status`). */
export const DROPOUT_STATUS = 'inactive';

/** Aluno desistente? Desistentes não participam de IRA, medalhas ou ranking. */
export function isDropout(status: string | null | undefined): boolean {
  return (status ?? 'active') === DROPOUT_STATUS;
}

export interface EligibilityInput {
  id: string;
  status?: string | null;
}

/** Separa alunos elegíveis (ativos) dos desistentes. */
export function splitByEligibility<T extends EligibilityInput>(students: T[]) {
  const eligible: T[] = [];
  const dropouts: T[] = [];
  students.forEach((s) => (isDropout(s.status) ? dropouts : eligible).push(s));
  return { eligible, dropouts };
}

export interface IraSnapshotRow {
  student_id: string;
  class_id: string | null;
  class_name: string | null;
  series: string | null;
  eligible: boolean;
  ira_value: number | null;
  ira_status: string;
  ira_reason: string | null;
  medals: StudentMedal[];
  computed_at: string;
  computed_by: string | null;
}

export interface SnapshotBuildInput {
  studentId: string;
  status?: string | null;
  classId: string | null;
  className: string | null;
  series: string | null;
  ira?: IraResult | null;
  medals?: StudentMedal[];
}

/**
 * Monta as linhas de snapshot. Desistentes são persistidos como inelegíveis com
 * valor nulo e sem medalhas — assim qualquer cache antigo é limpo no recálculo.
 */
export function buildSnapshotRows(
  inputs: SnapshotBuildInput[],
  computedBy: string | null,
  computedAt: string = new Date().toISOString(),
): IraSnapshotRow[] {
  return inputs.map((input) => {
    const dropout = isDropout(input.status);
    if (dropout) {
      return {
        student_id: input.studentId,
        class_id: input.classId,
        class_name: input.className,
        series: input.series,
        eligible: false,
        ira_value: null,
        ira_status: 'ineligible',
        ira_reason: 'Aluno desistente — não participa do IRA nem das medalhas',
        medals: [],
        computed_at: computedAt,
        computed_by: computedBy,
      };
    }
    const ira = input.ira ?? null;
    return {
      student_id: input.studentId,
      class_id: input.classId,
      class_name: input.className,
      series: input.series,
      eligible: true,
      ira_value: ira && ira.status === 'ok' ? ira.value ?? null : null,
      ira_status: ira?.status ?? 'unavailable',
      ira_reason: ira && ira.status !== 'ok' ? ira.reason ?? null : null,
      medals: input.medals ?? [],
      computed_at: computedAt,
      computed_by: computedBy,
    };
  });
}

export type IraDisplayState = 'never' | 'stale' | 'fresh';

/**
 * Estado de exibição na tela Alunos:
 * - `never`: nunca houve cálculo → mostrar "—" e nenhuma medalha.
 * - `stale`: existe cache, mas alguma turma do escopo foi marcada como
 *   desatualizada → manter o último valor com aviso.
 */
export function resolveDisplayState(opts: { hasSnapshot: boolean; stale: boolean }): IraDisplayState {
  if (!opts.hasSnapshot) return 'never';
  return opts.stale ? 'stale' : 'fresh';
}

export interface StalenessRow {
  stale: boolean;
  last_computed_at: string | null;
}

/**
 * Deriva o estado salvo do IRA a partir das linhas de `ira_staleness`.
 *
 * Regras:
 * - Ausência de linha significa "nunca calculado", NUNCA "desatualizado".
 * - `stale` só é verdadeiro quando alguma turma foi explicitamente marcada
 *   (notas ou configurações do IRA alteradas).
 */
export function resolveIraFreshness(opts: {
  hasSnapshot: boolean;
  rows: StalenessRow[];
}): { stale: boolean; neverCalculated: boolean; lastComputedAt: string | null } {
  const computedDates = opts.rows.map((r) => r.last_computed_at).filter(Boolean) as string[];
  const neverCalculated = !opts.hasSnapshot || computedDates.length === 0;
  return {
    stale: !neverCalculated && opts.rows.some((r) => r.stale),
    neverCalculated,
    lastComputedAt: computedDates.length > 0 ? computedDates.slice().sort().slice(-1)[0] : null,
  };
}
