/**
 * Lógica pura da "Frequência diária das turmas".
 *
 * O status do dia NÃO depende da existência de registros individuais em
 * `attendance` (que podem ser parciais, criados por leitura de QR code).
 * Ele depende de um registro de FECHAMENTO em `daily_attendance_closures`
 * (turma + data), gravado quando o professor salva a chamada da turma.
 */

export type DailyClassStatus = 'done' | 'pending';

export interface ClassInfo {
  id: string;
  name: string;
  shift?: string | null;
}

export interface StudentLike {
  id: string;
  class: string;
  status?: string | null;
}

export interface ClosureLike {
  class_name: string;
  date: string;
  present_count?: number | null;
  absent_count?: number | null;
  updated_at?: string | null;
}

export interface DailyClassRow {
  id: string;
  name: string;
  shift?: string | null;
  activeStudents: number;
  status: DailyClassStatus;
  presentCount: number | null;
  absentCount: number | null;
  updatedAt: string | null;
}

/**
 * Data LOCAL do usuário no formato yyyy-MM-dd.
 * Usa os getters locais para evitar que `toISOString()` (UTC) vire o dia
 * antes da hora no Brasil.
 */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekend(date: Date = new Date()): boolean {
  return [0, 6].includes(date.getDay());
}

/** Somente alunos ativos entram na contagem/chamada. */
export function countActiveStudents(students: StudentLike[], className: string): number {
  return students.filter((s) => s.class === className && (s.status ?? 'active') === 'active').length;
}

export function buildDailyClassRows(
  classes: ClassInfo[],
  students: StudentLike[],
  closures: ClosureLike[],
  dateKey: string,
): DailyClassRow[] {
  const closureByClass = new Map<string, ClosureLike>();
  for (const c of closures) {
    if (c.date === dateKey) closureByClass.set(c.class_name, c);
  }

  const rows = classes.map<DailyClassRow>((cls) => {
    const closure = closureByClass.get(cls.name);
    return {
      id: cls.id,
      name: cls.name,
      shift: cls.shift ?? null,
      activeStudents: countActiveStudents(students, cls.name),
      status: closure ? 'done' : 'pending',
      presentCount: closure?.present_count ?? null,
      absentCount: closure?.absent_count ?? null,
      updatedAt: closure?.updated_at ?? null,
    };
  });

  // Pendentes primeiro, depois ordem alfabética.
  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export interface DailySummary {
  total: number;
  done: number;
  pending: number;
}

export function summarizeDaily(rows: DailyClassRow[]): DailySummary {
  const done = rows.filter((r) => r.status === 'done').length;
  return { total: rows.length, done, pending: rows.length - done };
}
