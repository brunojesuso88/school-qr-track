/**
 * Preferências gerais da escola (não sensíveis), persistidas em `settings`
 * por `school_id`. Leitura pelo RPC `get_school_preferences` (menor privilégio).
 *
 * Observação: a chave legada `current_bimester` pode ainda existir em `settings`
 * de escolas antigas; ela é ignorada na leitura e nunca mais é gravada pela UI.
 */

export const STUDENT_SORT_OPTIONS = ['name-asc', 'ira-desc', 'absences-desc'] as const;
export type StudentSortPreference = (typeof STUDENT_SORT_OPTIONS)[number];

export const STUDENT_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
export type StudentStatusFilter = (typeof STUDENT_STATUS_FILTERS)[number];

export interface SchoolPreferences {
  academic_year: number;
  /** Comportamento atual do sistema: desistentes aparecem na listagem. */
  show_inactive_students: boolean;
  default_student_sort: StudentSortPreference;
}

export const MIN_ACADEMIC_YEAR = 2020;
export const MAX_ACADEMIC_YEAR = 2100;

export const defaultSchoolPreferences = (): SchoolPreferences => ({
  academic_year: new Date().getFullYear(),
  show_inactive_students: true,
  default_student_sort: 'name-asc',
});

/** Aceita valores gravados como JSON puro ou como string JSON legada. */
const unwrap = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

export function isValidAcademicYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_ACADEMIC_YEAR && year <= MAX_ACADEMIC_YEAR;
}

/** Normaliza o payload do RPC, aplicando defaults para chaves ausentes/inválidas. */
export function parseSchoolPreferences(raw: unknown): SchoolPreferences {
  const base = defaultSchoolPreferences();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;

  const year = Number(unwrap(src.academic_year));
  if (isValidAcademicYear(year)) base.academic_year = year;

  const show = unwrap(src.show_inactive_students);
  if (typeof show === 'boolean') base.show_inactive_students = show;
  else if (show === 'true' || show === 'false') base.show_inactive_students = show === 'true';

  const sort = unwrap(src.default_student_sort);
  if (typeof sort === 'string' && (STUDENT_SORT_OPTIONS as readonly string[]).includes(sort)) {
    base.default_student_sort = sort as StudentSortPreference;
  }

  return base;
}

/** Status inicial da tela Alunos conforme a preferência da escola. */
export function initialStudentStatusFilter(showInactive: boolean): StudentStatusFilter {
  return showInactive ? 'all' : 'active';
}

export const STUDENT_SORT_LABELS: Record<StudentSortPreference, string> = {
  'name-asc': 'Nome A–Z',
  'ira-desc': 'Maior IRA primeiro',
  'absences-desc': 'Mais faltas primeiro',
};
