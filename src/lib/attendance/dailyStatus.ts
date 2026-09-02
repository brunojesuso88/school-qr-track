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

/* ------------------------------------------------------------------ *
 * Persistência canônica da chamada de turma (usada em Turmas e em
 * Frequência > Frequência diária — mesma fonte de verdade).
 * ------------------------------------------------------------------ */

export type AttendanceMark = 'present' | 'absent' | 'justified';

/**
 * Estado inicial da chamada: todos presentes por padrão, preservando
 * registros já existentes (inclusive "justified").
 */
export function mergeExistingStatuses(
  students: { id: string }[],
  existing: { student_id: string; status: string }[],
): Record<string, AttendanceMark> {
  const map = new Map(existing.map((e) => [e.student_id, e.status]));
  const out: Record<string, AttendanceMark> = {};
  for (const s of students) {
    const current = map.get(s.id);
    out[s.id] = current === 'absent' ? 'absent' : current === 'justified' ? 'justified' : 'present';
  }
  return out;
}

export function countMarks(students: { id: string }[], marks: Record<string, AttendanceMark>) {
  let present = 0;
  let absent = 0;
  let justified = 0;
  for (const s of students) {
    const m = marks[s.id] ?? 'present';
    if (m === 'absent') absent++;
    else if (m === 'justified') justified++;
    else present++;
  }
  return { present, absent, justified, total: students.length };
}

/** Linhas de `attendance` (unicidade lógica student_id + date). */
export function buildAttendanceRecords(
  students: { id: string }[],
  marks: Record<string, AttendanceMark>,
  dateKey: string,
  time: string,
  recordedBy: string | null,
  schoolId?: string | null,
) {
  return students.map((s) => ({
    ...(schoolId ? { school_id: schoolId } : {}),
    student_id: s.id,
    date: dateKey,
    status: marks[s.id] ?? 'present',
    time,
    recorded_by: recordedBy,
  }));
}

/** Fechamento diário (unicidade lógica class_name + date). */
export function buildClosureRow(
  className: string,
  dateKey: string,
  shift: string | null,
  counts: { present: number; absent: number; justified: number; total: number },
  closedBy: string | null,
  updatedAt: string,
  schoolId?: string | null,
) {
  return {
    ...(schoolId ? { school_id: schoolId } : {}),
    class_name: className,
    date: dateKey,
    shift: shift ?? null,
    student_count: counts.total,
    present_count: counts.present,
    absent_count: counts.absent + counts.justified,
    closed_by: closedBy,
    updated_at: updatedAt,
  };
}
