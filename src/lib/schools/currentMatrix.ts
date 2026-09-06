/**
 * MATRIZ VIGENTE DA ESCOLA (`schools.curriculum_matrix_id`).
 *
 * Fonte de verdade única: a matriz já escolhida na criação da escola. Este módulo
 * apenas LÊ esse vínculo e troca-o pela RPC segura já existente
 * (`admin_set_school_curriculum_matrix`) — nunca por update direto do cliente e
 * nunca criando/copiando matriz.
 */
import { supabase } from '@/integrations/supabase/client';
import { CurriculumMatrixRecord, fetchSchoolMatrices } from '@/lib/curriculumMatrices';

const rpcClient = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

/**
 * PURO — opções válidas do selector: SOMENTE matrizes da própria escola.
 * Nunca ofereça matriz materializada de outra escola.
 */
export function matrixOptionsForSchool(
  matrices: CurriculumMatrixRecord[],
  schoolId: string,
): CurriculumMatrixRecord[] {
  return matrices.filter((m) => m.school_id === schoolId);
}

/** PURO — valor pré-selecionado: a matriz vigente, se ela pertencer à escola. */
export function preselectedMatrixId(
  matrices: CurriculumMatrixRecord[],
  schoolId: string,
  currentMatrixId: string | null | undefined,
): string {
  if (!currentMatrixId) return '';
  return matrixOptionsForSchool(matrices, schoolId).some((m) => m.id === currentMatrixId)
    ? currentMatrixId
    : '';
}

/** PURO — salvar sem trocar a matriz não deve gerar trabalho algum. */
export function needsMatrixUpdate(
  currentMatrixId: string | null | undefined,
  draftMatrixId: string,
): boolean {
  return !!draftMatrixId && draftMatrixId !== (currentMatrixId ?? '');
}

/** Matriz vigente + matrizes disponíveis de UMA escola. */
export async function fetchSchoolMatrixContext(schoolId: string): Promise<{
  currentMatrixId: string | null;
  matrices: CurriculumMatrixRecord[];
}> {
  const [schoolRes, matrices] = await Promise.all([
    supabase.from('schools').select('curriculum_matrix_id').eq('id', schoolId).maybeSingle(),
    fetchSchoolMatrices(schoolId),
  ]);
  if (schoolRes.error) throw schoolRes.error;
  const current = (schoolRes.data as { curriculum_matrix_id: string | null } | null)?.curriculum_matrix_id ?? null;
  return { currentMatrixId: current, matrices: matrixOptionsForSchool(matrices, schoolId) };
}

/** Troca a matriz vigente pela RPC segura. Não toca notas, alunos ou turmas. */
export async function setSchoolCurriculumMatrix(schoolId: string, matrixId: string): Promise<void> {
  const { error } = await rpcClient.rpc('admin_set_school_curriculum_matrix', {
    _school_id: schoolId,
    _matrix_id: matrixId,
  });
  if (error) throw new Error(error.message);
}
