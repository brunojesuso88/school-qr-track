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
 * Presença global da escola no dia ("Presentes hoje: X de Y alunos — Z%").
 *
 * Conjunto VÁLIDO de alunos (Y): linhas de `students` da própria escola com
 * status ativo e cuja `class` corresponde a uma turma válida da escola
 * (`classes.name`). Inativos/transferidos, órfãos de turma ou alunos de outra
 * escola ficam fora — tanto de Y quanto de X.
 *
 * X = alunos DISTINTOS desse conjunto com registro `present` em `attendance`
 * na data local informada (QR code ou chamada de turma — qualquer origem).
 * `justified`/`absent` não contam; vários registros do mesmo aluno = 1.
 *
 * O helper recebe SEMPRE os dados completos da escola — nunca a lista já
 * filtrada pela busca/filtros visuais da tela.
 * ------------------------------------------------------------------ */

export interface PresenceRecordLike {
  student_id: string;
  status: string;
  date?: string | null;
}

export interface SchoolPresence {
  present: number;
  total: number;
  /** 0–100 (fração exata, sem arredondar); 0 quando não há alunos válidos. */
  percent: number;
}

export interface SchoolPresenceOptions {
  /** Data local (yyyy-MM-dd). Registros de outra data são ignorados. */
  dateKey?: string | null;
  /**
   * Nomes das turmas válidas da escola. Quando informado, alunos cuja `class`
   * não está na lista são excluídos do conjunto válido (órfãos). Quando
   * omitido, não há filtro por turma.
   */
  validClassNames?: Iterable<string> | null;
}

/** Alunos válidos para o contador global (ativos e com turma válida). */
export function validPresenceStudentIds(
  students: StudentLike[],
  validClassNames?: Iterable<string> | null,
): Set<string> {
  const classSet = validClassNames ? new Set(validClassNames) : null;
  const ids = new Set<string>();
  for (const s of students) {
    if ((s.status ?? 'active') !== 'active') continue;
    if (classSet && !classSet.has(s.class)) continue;
    ids.add(s.id);
  }
  return ids;
}

export function computeSchoolPresence(
  students: StudentLike[],
  records: PresenceRecordLike[],
  options: SchoolPresenceOptions = {},
): SchoolPresence {
  const { dateKey, validClassNames } = options;
  const validIds = validPresenceStudentIds(students, validClassNames);
  const presentIds = new Set<string>();
  for (const r of records) {
    if (r.status !== 'present') continue;
    if (dateKey && r.date && r.date !== dateKey) continue;
    if (!validIds.has(r.student_id)) continue;
    presentIds.add(r.student_id);
  }
  const total = validIds.size;
  const present = Math.min(presentIds.size, total);
  const percent = total === 0 ? 0 : (present / total) * 100;
  return { present, total, percent };
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/**
 * Percentual amigável em pt-BR: inteiro quando exato ("25%", "100%"),
 * uma casa decimal quando necessário ("33,3%"). Valores inválidos viram "0%".
 */
export function formatPresencePercent(percent: number | null | undefined): string {
  const safe = Number.isFinite(percent) ? Math.max(0, percent as number) : 0;
  return `${percentFormatter.format(safe)}%`;
}

/** Valor da barra de progresso: sempre dentro de 0..100, sem alterar o valor lógico. */
export function presenceProgressValue(percent: number | null | undefined): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent as number));
}

/** Texto canônico do card: "Presentes hoje: X de Y alunos — Z%". */
export function formatSchoolPresence(p: SchoolPresence): string {
  return `Presentes hoje: ${p.present} de ${p.total} alunos — ${formatPresencePercent(p.percent)}`;
}

/* ------------------------------------------------------------------ *
 * Persistência canônica da chamada de turma (usada em Turmas e em
 * Frequência > Frequência diária — mesma fonte de verdade).
 * ------------------------------------------------------------------ */

/** Contrato da chamada diária: apenas Presente ou Ausente. */
export type AttendanceMark = 'present' | 'absent';

/**
 * Estado inicial da chamada: todos presentes por padrão.
 * Registros legados `justified` são exibidos como Ausente (histórico é preservado
 * no banco; ao salvar de novo a chamada passa a gravar `absent`).
 */
export function mergeExistingStatuses(
  students: { id: string }[],
  existing: { student_id: string; status: string }[],
): Record<string, AttendanceMark> {
  const map = new Map(existing.map((e) => [e.student_id, e.status]));
  const out: Record<string, AttendanceMark> = {};
  for (const s of students) {
    const current = map.get(s.id);
    out[s.id] = current === 'absent' || current === 'justified' ? 'absent' : 'present';
  }
  return out;
}

export function countMarks(students: { id: string }[], marks: Record<string, AttendanceMark>) {
  let present = 0;
  let absent = 0;
  for (const s of students) {
    if ((marks[s.id] ?? 'present') === 'absent') absent++;
    else present++;
  }
  return { present, absent, total: students.length };
}


/** Linhas de `attendance` (unicidade lógica student_id + date). */
export function buildAttendanceRecords(
  students: { id: string }[],
  marks: Record<string, AttendanceMark>,
  dateKey: string,
  time: string,
  recordedBy: string | null,
  schoolId: string,
) {
  return students.map((s) => ({
    school_id: schoolId,
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
  counts: { present: number; absent: number; total: number },
  closedBy: string | null,
  updatedAt: string,
  schoolId: string,
) {
  return {
    school_id: schoolId,
    class_name: className,
    date: dateKey,
    shift: shift ?? null,
    student_count: counts.total,
    present_count: counts.present,
    absent_count: counts.absent,

    closed_by: closedBy,
    updated_at: updatedAt,
  };
}
