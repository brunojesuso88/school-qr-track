/**
 * Helpers puros de filtragem da página Alunos.
 * Não altera regras de negócio (IRA, medalhas, notas): apenas seleção visual.
 */

export type ShiftFilter = 'all' | 'morning' | 'afternoon' | 'evening' | string;

export interface ClassOptionSource {
  name: string;
  shift?: string | null;
}

export interface StudentShiftSource {
  class: string;
  shift?: string | null;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/**
 * Turmas disponíveis para o turno selecionado.
 *
 * Fonte canônica: tabela `classes` (campo estruturado `shift`).
 * Turmas presentes apenas nos alunos (sem cadastro canônico) entram como
 * fallback, usando o turno estruturado do próprio aluno.
 */
export function classOptionsForShift(
  classes: ClassOptionSource[],
  students: StudentShiftSource[],
  shift: ShiftFilter,
): string[] {
  const canonicalNames = new Set(
    classes.map((c) => c.name).filter((n): n is string => !!n && n.trim() !== ''),
  );

  const result = new Set<string>();

  classes.forEach((c) => {
    if (!c.name || c.name.trim() === '') return;
    if (shift === 'all' || c.shift === shift) result.add(c.name);
  });

  students.forEach((s) => {
    if (!s.class || s.class.trim() === '') return;
    if (canonicalNames.has(s.class)) return; // já tratada pela fonte canônica
    if (shift === 'all' || s.shift === shift) result.add(s.class);
  });

  return [...result].sort(byName);
}

/** A turma selecionada continua válida no turno escolhido? */
export function isClassValidForShift(
  classes: ClassOptionSource[],
  students: StudentShiftSource[],
  shift: ShiftFilter,
  selectedClass: string,
): boolean {
  if (selectedClass === 'all') return true;
  return classOptionsForShift(classes, students, shift).includes(selectedClass);
}

/**
 * Filtro visual "somente alunos com medalhas".
 * As medalhas já vêm calculadas por série completa — este filtro só exibe.
 */
export function hasMedals(
  medalsByStudent: Record<string, unknown[] | undefined>,
  studentId: string,
): boolean {
  return (medalsByStudent[studentId]?.length ?? 0) > 0;
}
