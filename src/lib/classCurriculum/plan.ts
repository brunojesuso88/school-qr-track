/**
 * Núcleo PURO da sincronização TURMA → SÉRIE → MATRIZ CURRICULAR → DISCIPLINAS DE NOTAS.
 * Sem acesso a rede/banco: recebe o estado atual da turma e devolve o plano de escrita.
 */
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { normalizeText } from '@/lib/gradePageLocal/normalize';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';

export interface ExistingMappingSubject {
  id: string;
  subject_name: string;
  weekly_classes: number | null;
}

export interface ExistingGradeSubject {
  id: string;
  name: string;
  weekly_classes: number | null;
  include_in_ira: boolean;
  /** Ocorrência do componente na turma (1 = única/primeira). */
  slot_index?: number | null;
  legacy_excluded?: boolean | null;
  mapping_class_subject_id?: string | null;
  sort_order?: number | null;
  /** `true` quando a disciplina já possui `student_grades` (histórico a preservar). */
  hasGrades?: boolean;
}

export interface EquivalentDuplicateGroup {
  /** Nome oficial da matriz para o qual o grupo converge. */
  canonicalName: string;
  targetId: string;
  targetName: string;
  duplicates: { id: string; name: string; hasGrades: boolean }[];
}

export interface ClassCurriculumPlan {
  mappingCreate: { subject_name: string; weekly_classes: number }[];
  mappingUpdate: { id: string; weekly_classes: number }[];
  gradeCreate: {
    name: string;
    normalized_name: string;
    slot_index: number;
    weekly_classes: number | null;
    include_in_ira: true;
    legacy_excluded: false;
    sort_order: number;
  }[];
  gradeUpdate: {
    id: string;
    name: string;
    normalized_name: string;
    slot_index: number;
    weekly_classes: number | null;
    include_in_ira: boolean;
    legacy_excluded: false;
    sort_order: number;
  }[];
  /**
   * Nomenclaturas históricas equivalentes (mesma identidade canônica) que devem
   * ser CONSOLIDADAS no registro oficial, sem perda de notas.
   */
  gradeEquivalentDuplicates: EquivalentDuplicateGroup[];
  /** Disciplinas fora da matriz da série: saem da UI/IRA, histórico preservado. */
  gradeLegacy: { id: string; name: string; hasGrades: boolean }[];
  counts: { created: number; reused: number; updated: number; excludedLegacy: number; consolidated: number };
}

/** Todas as chaves canônicas que identificam um componente da matriz. */
const matrixKeys = (item: { name: string; aliases?: string[] | null }) =>
  [item.name, ...(item.aliases ?? [])].map((k) => canonicalSubjectKey(k)).filter(Boolean);

/**
 * Escolhe o registro DESTINO entre disciplinas equivalentes:
 * 1) nome exatamente igual ao da matriz (evita renomear alias para um
 *    `normalized_name` já existente e violar UNIQUE(class_id, normalized_name));
 * 2) registro com histórico de notas;
 * 3) primeiro candidato determinístico (ordem estável por id).
 */
function pickTarget<T extends { id: string; name: string; hasGrades?: boolean }>(
  candidates: T[],
  canonicalName: string,
): T {
  const ordered = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const exact = ordered.find((c) => normalizeText(c.name) === normalizeText(canonicalName));
  if (exact) return exact;
  return ordered.find((c) => c.hasGrades) ?? ordered[0];
}


/**
 * Plano idempotente de sincronização. Executar duas vezes sobre o mesmo estado
 * resultante produz `gradeCreate`/`gradeUpdate` vazios.
 */
export function planClassCurriculumSync(input: {
  matrix: CurriculumMatrixItem[];
  mappingSubjects?: ExistingMappingSubject[];
  gradeSubjects?: ExistingGradeSubject[];
  /**
   * `false` quando a turma não tem `mapping_class_id`: a camada `mapping_*` é
   * auxiliar/legada, então nenhuma ação de mapeamento é planejada e o plano pode
   * ficar em sync apenas com `grade_subjects` alinhados.
   */
  manageMapping?: boolean;
}): ClassCurriculumPlan {
  // Ordem oficial única: alfabética (pt-BR) pelo nome da matriz — a mesma usada
  // por `fetchCurriculumMatrix`. Ocorrências (slots) do mesmo componente ficam
  // lado a lado, na ordem do slot. `sort_order` recebe exatamente este índice.
  const matrix = [...input.matrix].sort(
    (a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.slot_index ?? 1) - (b.slot_index ?? 1),
  );
  const mappingSubjects = input.mappingSubjects ?? [];
  const gradeSubjects = input.gradeSubjects ?? [];
  const manageMapping = input.manageMapping ?? true;

  const plan: ClassCurriculumPlan = {
    mappingCreate: [], mappingUpdate: [], gradeCreate: [], gradeUpdate: [],
    gradeEquivalentDuplicates: [], gradeLegacy: [],
    counts: { created: 0, reused: 0, updated: 0, excludedLegacy: 0, consolidated: 0 },
  };

  const usedGradeIds = new Set<string>();
  // Registros já arquivados (consolidados/legados) não voltam ao plano: idempotência.
  const isArchived = (g: ExistingGradeSubject) => Boolean(g.legacy_excluded) && g.include_in_ira === false;

  matrix.forEach((item, index) => {
    const keys = matrixKeys(item);
    const normalizedName = normalizeText(item.name);
    const slot = item.slot_index ?? 1;

    // --- mapping_class_subjects (camada auxiliar: só a 1ª ocorrência) ---
    // Componentes sem carga semanal (matrizes de média aritmética, ex.: Integral)
    // NÃO passam pela camada auxiliar `mapping_class_subjects`: inventar carga 1
    // criaria uma carga acadêmica fictícia.
    if (manageMapping && slot === 1 && item.weekly_classes != null) {
      const mappingMatches = mappingSubjects.filter((m) => keys.includes(canonicalSubjectKey(m.subject_name)));
      if (mappingMatches.length === 0) {
        plan.mappingCreate.push({ subject_name: item.name, weekly_classes: item.weekly_classes });
      } else {
        const chosen = pickTarget(mappingMatches.map((m) => ({ ...m, name: m.subject_name })), item.name);
        const expected = item.weekly_classes ?? null;
        if (expected != null && (chosen.weekly_classes ?? null) !== expected) {
          plan.mappingUpdate.push({ id: chosen.id, weekly_classes: expected });
        }
      }
    }

    // --- grade_subjects (identidade canônica + ocorrência/slot) ---
    const gradeMatches = gradeSubjects.filter(
      (g) => !usedGradeIds.has(g.id) && !isArchived(g)
        && (g.slot_index ?? 1) === slot
        && keys.includes(canonicalSubjectKey(g.name)),
    );
    if (gradeMatches.length === 0) {
      plan.gradeCreate.push({
        name: item.name,
        normalized_name: normalizedName,
        slot_index: slot,
        weekly_classes: item.weekly_classes ?? null,
        include_in_ira: true,
        legacy_excluded: false,
        sort_order: index,
      });
      plan.counts.created += 1;
      return;
    }
    const chosen = pickTarget(gradeMatches, item.name);
    gradeMatches.forEach((g) => usedGradeIds.add(g.id));
    plan.counts.reused += 1;

    // Equivalentes históricos: consolidar no destino, nunca tratar como "fora da matriz".
    const duplicates = gradeMatches.filter((g) => g.id !== chosen.id);
    if (duplicates.length > 0) {
      plan.gradeEquivalentDuplicates.push({
        canonicalName: item.name,
        targetId: chosen.id,
        targetName: chosen.name,
        duplicates: duplicates.map((d) => ({ id: d.id, name: d.name, hasGrades: Boolean(d.hasGrades) })),
      });
      plan.counts.consolidated += duplicates.length;
    }

    const target = {
      name: item.name,
      normalized_name: normalizedName,
      slot_index: slot,
      weekly_classes: item.weekly_classes ?? null,
      include_in_ira: item.include_in_ira ? true : chosen.include_in_ira,
      legacy_excluded: false as const,
      sort_order: index,
    };
    const changed =
      chosen.name !== target.name ||
      (chosen.weekly_classes ?? null) !== target.weekly_classes ||
      chosen.include_in_ira !== target.include_in_ira ||
      (chosen.slot_index ?? 1) !== slot ||
      Boolean(chosen.legacy_excluded) !== false ||
      (chosen.sort_order ?? -1) !== target.sort_order;
    if (changed) {
      plan.gradeUpdate.push({ id: chosen.id, ...target });
      plan.counts.updated += 1;
    }
  });

  // Sobras: disciplinas realmente fora da matriz da série.
  gradeSubjects
    .filter((g) => !usedGradeIds.has(g.id))
    .forEach((g) => {
      if (isArchived(g)) return; // já excluída — idempotente
      plan.gradeLegacy.push({ id: g.id, name: g.name, hasGrades: Boolean(g.hasGrades) });
      plan.counts.excludedLegacy += 1;
    });


  return plan;
}

/** `true` quando a turma já está exatamente igual à matriz oficial da série. */
export const isPlanInSync = (plan: ClassCurriculumPlan) =>
  plan.gradeCreate.length === 0 && plan.gradeUpdate.length === 0 &&
  plan.gradeEquivalentDuplicates.length === 0 &&
  plan.gradeLegacy.length === 0 && plan.mappingCreate.length === 0 &&
  plan.mappingUpdate.length === 0;

/** Resumo curto para a UI: “3 disciplinas faltando · 2 cargas desatualizadas · 1 legada”. */
export function describePlan(plan: ClassCurriculumPlan): string {
  const parts: string[] = [];
  if (plan.gradeCreate.length) parts.push(`${plan.gradeCreate.length} disciplina(s) faltando`);
  if (plan.gradeUpdate.length) parts.push(`${plan.gradeUpdate.length} disciplina(s) desatualizada(s)`);
  if (plan.counts.consolidated) parts.push(`${plan.counts.consolidated} nomenclatura(s) equivalente(s) a consolidar`);
  if (plan.gradeLegacy.length) parts.push(`${plan.gradeLegacy.length} disciplina(s) legada(s)`);
  if (plan.mappingCreate.length || plan.mappingUpdate.length) {
    parts.push(`${plan.mappingCreate.length + plan.mappingUpdate.length} ajuste(s) no mapeamento`);
  }
  return parts.length ? parts.join(' · ') : 'Turma sincronizada com a matriz oficial da série';
}

