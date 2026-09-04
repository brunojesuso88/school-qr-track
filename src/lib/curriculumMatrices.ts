/**
 * MATRIZES CURRICULARES NOMEADAS POR ESCOLA.
 *
 * Cada escola possui uma "Matriz Original" protegida (semeada pelo banco) e pode
 * criar outras matrizes. Toda leitura/escrita é filtrada por `school_id`; a matriz
 * é sempre identificada por UUID + escola ativa — nunca por nome.
 */
import { supabase } from '@/integrations/supabase/client';
import { HighSchoolSeries } from '@/lib/series';

export interface CurriculumMatrixRecord {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  is_original: boolean;
  /** Total de componentes (todas as séries). */
  components: number;
}

export interface MatrixComponentRow {
  id: string;
  matrix_id: string;
  subject_id: string;
  series: HighSchoolSeries;
  weekly_classes: number;
  include_in_ira: boolean;
  name: string;
  abbreviation: string | null;
  aliases: string[];
}

interface RawComponent {
  id: string;
  matrix_id: string;
  subject_id: string;
  series: string;
  weekly_classes: number;
  include_in_ira: boolean;
  mapping_global_subjects: { name: string; abbreviation: string | null; aliases: string[] | null } | null;
}

const rpcClient = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Chave de identidade de um componente dentro de uma matriz. */
export const componentKey = (c: { subject_id: string; series: string }) => `${c.subject_id}::${c.series}`;

/**
 * PURO: componentes de outra matriz que podem ser importados sem duplicar.
 * Duplicata = mesma disciplina na mesma série já presente no destino.
 */
export function planComponentImport<T extends { subject_id: string; series: string }>(
  source: T[],
  target: { subject_id: string; series: string }[],
): { toInsert: T[]; skipped: T[] } {
  const have = new Set(target.map(componentKey));
  const seen = new Set<string>();
  const toInsert: T[] = [];
  const skipped: T[] = [];
  source.forEach((c) => {
    const key = componentKey(c);
    if (have.has(key) || seen.has(key)) { skipped.push(c); return; }
    seen.add(key);
    toInsert.push(c);
  });
  return { toInsert, skipped };
}

/** Matrizes da escola ativa, com a Matriz Original sempre em primeiro. */
export async function fetchSchoolMatrices(schoolId: string | null | undefined): Promise<CurriculumMatrixRecord[]> {
  if (!schoolId) return [];
  const [matrixRes, countRes] = await Promise.all([
    supabase
      .from('curriculum_matrices')
      .select('id, school_id, name, description, is_original')
      .eq('school_id', schoolId),
    supabase
      .from('curriculum_matrix_subjects')
      .select('matrix_id')
      .eq('school_id', schoolId),
  ]);
  if (matrixRes.error) throw matrixRes.error;
  if (countRes.error) throw countRes.error;
  const counts = new Map<string, number>();
  ((countRes.data ?? []) as { matrix_id: string }[]).forEach((r) => {
    counts.set(r.matrix_id, (counts.get(r.matrix_id) ?? 0) + 1);
  });
  return ((matrixRes.data ?? []) as Omit<CurriculumMatrixRecord, 'components'>[])
    .map((m) => ({ ...m, components: counts.get(m.id) ?? 0 }))
    .sort((a, b) => Number(b.is_original) - Number(a.is_original) || a.name.localeCompare(b.name, 'pt-BR'));
}

/** UUID da Matriz Original da escola (semeada pelo banco). */
export async function fetchOriginalMatrixId(schoolId: string | null | undefined): Promise<string | null> {
  if (!schoolId) return null;
  const { data, error } = await supabase
    .from('curriculum_matrices')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_original', true)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** Componentes de uma matriz (opcionalmente de uma série), ordenados por nome. */
export async function fetchMatrixComponents(
  matrixId: string,
  schoolId: string,
): Promise<MatrixComponentRow[]> {
  const { data, error } = await supabase
    .from('curriculum_matrix_subjects')
    .select('id, matrix_id, subject_id, series, weekly_classes, include_in_ira, mapping_global_subjects(name, abbreviation, aliases)')
    .eq('school_id', schoolId)
    .eq('matrix_id', matrixId);
  if (error) throw error;
  return ((data ?? []) as unknown as RawComponent[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      id: r.id,
      matrix_id: r.matrix_id,
      subject_id: r.subject_id,
      series: r.series as HighSchoolSeries,
      weekly_classes: r.weekly_classes,
      include_in_ira: r.include_in_ira,
      name: r.mapping_global_subjects!.name,
      abbreviation: r.mapping_global_subjects!.abbreviation,
      aliases: r.mapping_global_subjects!.aliases ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Garante que a matriz informada pertence à escola ativa (bloqueio cross-school). */
export async function assertMatrixInSchool(matrixId: string, schoolId: string): Promise<void> {
  const { data, error } = await supabase
    .from('curriculum_matrices')
    .select('id')
    .eq('school_id', schoolId)
    .eq('id', matrixId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Matriz curricular não pertence à escola ativa.');
}

/** Cria uma matriz nomeada, opcionalmente copiando os componentes de outra matriz DA MESMA escola. */
export async function createCurriculumMatrix(input: {
  schoolId: string;
  name: string;
  description?: string | null;
  copyFromMatrixId?: string | null;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome da matriz curricular.');
  if (input.copyFromMatrixId) await assertMatrixInSchool(input.copyFromMatrixId, input.schoolId);

  const { data, error } = await supabase
    .from('curriculum_matrices')
    .insert({
      school_id: input.schoolId,
      name,
      description: input.description?.trim() ? input.description.trim() : null,
      is_original: false,
    })
    .select('id')
    .single();
  if (error) throw error;
  const matrixId = (data as { id: string }).id;

  if (input.copyFromMatrixId) {
    const source = await fetchMatrixComponents(input.copyFromMatrixId, input.schoolId);
    await importMatrixComponents({
      schoolId: input.schoolId,
      targetMatrixId: matrixId,
      components: source,
    });
  }
  return matrixId;
}

/** Importa componentes (de outra matriz da mesma escola) sem duplicar. */
export async function importMatrixComponents(input: {
  schoolId: string;
  targetMatrixId: string;
  components: { subject_id: string; series: string; weekly_classes: number; include_in_ira: boolean }[];
}): Promise<{ imported: number; skipped: number }> {
  await assertMatrixInSchool(input.targetMatrixId, input.schoolId);
  const target = await fetchMatrixComponents(input.targetMatrixId, input.schoolId);
  const { toInsert, skipped } = planComponentImport(input.components, target);
  if (toInsert.length > 0) {
    const { error } = await supabase.from('curriculum_matrix_subjects').insert(
      toInsert.map((c) => ({
        school_id: input.schoolId,
        matrix_id: input.targetMatrixId,
        subject_id: c.subject_id,
        series: c.series,
        weekly_classes: c.weekly_classes,
        include_in_ira: c.include_in_ira,
      })),
    );
    if (error) throw error;
  }
  return { imported: toInsert.length, skipped: skipped.length };
}

export interface CatalogSubjectRecord {
  id: string;
  name: string;
  abbreviation: string | null;
  aliases: string[];
  /** Séries em que a disciplina existe no catálogo da escola. */
  series: string[];
}

/** PURO: união idempotente de séries — nunca remove uma série já cadastrada. */
export const mergeSubjectSeries = (current: string[] | null | undefined, added: string) =>
  [...new Set([...(current ?? []), added])].filter(Boolean).sort();

/** Catálogo de disciplinas da escola (identidade canônica de nome/abreviação/aliases). */
export async function fetchSchoolSubjectCatalog(schoolId: string): Promise<CatalogSubjectRecord[]> {
  const { data, error } = await supabase
    .from('mapping_global_subjects')
    .select('id, name, abbreviation, aliases, series')
    .eq('school_id', schoolId);
  if (error) throw error;
  return ((data ?? []) as {
    id: string; name: string; abbreviation: string | null; aliases: string[] | null; series: string[] | null;
  }[])
    .map((s) => ({ ...s, aliases: s.aliases ?? [], series: s.series ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Cria ou reaproveita a disciplina do catálogo da escola pelo nome. */
export async function ensureCatalogSubject(input: {
  schoolId: string;
  name: string;
  abbreviation?: string | null;
  aliases?: string[];
  series: HighSchoolSeries;
  weeklyClasses: number;
}): Promise<string> {
  const name = input.name.trim().toUpperCase();
  if (!name) throw new Error('Informe o nome da disciplina.');
  const catalog = await fetchSchoolSubjectCatalog(input.schoolId);
  const existing = catalog.find((s) => s.name.trim().toUpperCase() === name);

  if (existing) {
    const aliases = [...new Set([...(existing.aliases ?? []), ...(input.aliases ?? [])])].filter(Boolean);
    // Séries são acumulativas: a disciplina passa a valer também na nova série,
    // sem remover as séries já cadastradas. `default_weekly_classes` permanece
    // apenas como fallback canônico da escola e NÃO é sobrescrito por uma
    // matriz personalizada (a carga real fica em `curriculum_matrix_subjects`).
    const series = mergeSubjectSeries(existing.series, input.series);
    const { error } = await supabase
      .from('mapping_global_subjects')
      .update({
        abbreviation: input.abbreviation?.trim() ? input.abbreviation.trim() : existing.abbreviation,
        aliases,
        series,
      })
      .eq('id', existing.id)
      .eq('school_id', input.schoolId);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('mapping_global_subjects')
    .insert({
      school_id: input.schoolId,
      name,
      abbreviation: input.abbreviation?.trim() ? input.abbreviation.trim() : null,
      aliases: (input.aliases ?? []).filter(Boolean),
      series: [input.series],
      default_weekly_classes: input.weeklyClasses,
      shift: 'morning',
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Atribui a matriz a uma turma (RPC com validação de escola + registro em auditoria). */
export async function assignMatrixToClass(classId: string, matrixId: string): Promise<void> {
  const { error } = await rpcClient.rpc('set_class_curriculum_matrix', {
    _class_id: classId,
    _matrix_id: matrixId,
  });
  if (error) throw new Error(error.message);
}

/** Quantas turmas da escola estão vinculadas a esta matriz (bloqueia exclusão). */
export async function countClassesUsingMatrix(matrixId: string, schoolId: string): Promise<number> {
  const { count, error } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('curriculum_matrix_id', matrixId);
  if (error) throw error;
  return count ?? 0;
}

/** Reparo idempotente da Matriz Original em todas as escolas (apenas admin global). */
export async function repairSchoolCurricula(): Promise<{ schools: number; components_created: number }> {
  const { data, error } = await rpcClient.rpc('repair_school_curricula');
  if (error) throw new Error(error.message);
  return (data ?? { schools: 0, components_created: 0 }) as { schools: number; components_created: number };
}
