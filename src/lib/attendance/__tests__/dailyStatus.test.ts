import { describe, it, expect } from 'vitest';
import { localDateKey, countActiveStudents, buildDailyClassRows, summarizeDaily,
  computeSchoolPresence,
  formatPresencePercent,
  formatSchoolPresence,
} from '../dailyStatus';

const classes = [
  { id: 'c1', name: '26RMM101', shift: 'morning' },
  { id: 'c2', name: '26RMM102', shift: 'morning' },
  { id: 'c3', name: '26RMT201', shift: 'afternoon' },
];

const students = [
  { id: 's1', class: '26RMM101', status: 'active' },
  { id: 's2', class: '26RMM101', status: 'inactive' },
  { id: 's3', class: '26RMM101' },
  { id: 's4', class: '26RMM102', status: 'active' },
];

describe('localDateKey', () => {
  it('usa a data local, sem virar o dia por UTC', () => {
    // 23h no fuso -03:00 => ainda o mesmo dia local
    const d = new Date(2026, 7, 30, 23, 30, 0);
    expect(localDateKey(d)).toBe('2026-08-30');
  });

  it('formata com zero à esquerda', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});


describe('countActiveStudents', () => {
  it('conta apenas alunos ativos (default = active)', () => {
    expect(countActiveStudents(students, '26RMM101')).toBe(2);
    expect(countActiveStudents(students, '26RMT201')).toBe(0);
  });
});

describe('buildDailyClassRows', () => {
  const today = '2026-08-31';

  it('marca Realizada apenas com fechamento na turma+data', () => {
    const rows = buildDailyClassRows(
      classes,
      students,
      [{ class_name: '26RMM102', date: today, present_count: 1, absent_count: 0, updated_at: 'x' }],
      today,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName['26RMM102'].status).toBe('done');
    expect(byName['26RMM101'].status).toBe('pending');
  });

  it('frequência parcial (registros individuais) não conclui a turma', () => {
    // Nenhum fechamento => pendente, mesmo com alunos existentes
    const rows = buildDailyClassRows(classes, students, [], today);
    expect(rows.every((r) => r.status === 'pending')).toBe(true);
  });

  it('ignora fechamento de outra data', () => {
    const rows = buildDailyClassRows(
      classes,
      students,
      [{ class_name: '26RMM101', date: '2026-08-30' }],
      today,
    );
    expect(rows.find((r) => r.name === '26RMM101')!.status).toBe('pending');
  });

  it('ordena pendentes antes das realizadas', () => {
    const rows = buildDailyClassRows(
      classes,
      students,
      [{ class_name: '26RMM101', date: today }],
      today,
    );
    expect(rows.map((r) => r.status)).toEqual(['pending', 'pending', 'done']);
  });

  it('conta somente alunos ativos por turma', () => {
    const rows = buildDailyClassRows(classes, students, [], today);
    expect(rows.find((r) => r.name === '26RMM101')!.activeStudents).toBe(2);
  });
});

describe('summarizeDaily', () => {
  it('resume realizadas e pendentes', () => {
    const rows = buildDailyClassRows(
      classes,
      students,
      [{ class_name: '26RMM101', date: '2026-08-31' }],
      '2026-08-31',
    );
    expect(summarizeDaily(rows)).toEqual({ total: 3, done: 1, pending: 2 });
  });
});

import {
  mergeExistingStatuses,
  countMarks,
  buildAttendanceRecords,
  buildClosureRow,
  type AttendanceMark,
} from '../dailyStatus';

describe('persistência canônica compartilhada (Turmas e Frequência diária)', () => {
  const list = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  it('inicia todos como presentes e trata registro legado justificado como ausente', () => {
    const marks = mergeExistingStatuses(list, [
      { student_id: 's2', status: 'justified' },
      { student_id: 's3', status: 'absent' },
    ]);
    expect(marks).toEqual({ s1: 'present', s2: 'absent', s3: 'absent' });
  });

  it('conta apenas presentes e ausentes', () => {
    const marks: Record<string, AttendanceMark> = { s2: 'absent', s3: 'absent' };
    expect(countMarks(list, marks)).toEqual({ present: 1, absent: 2, total: 3 });
  });

  it('gera uma única linha por aluno+data com data local e responsável', () => {
    const recs = buildAttendanceRecords(list, { s3: 'absent' }, '2026-08-31', '07:10:00', 'u1', 'esc-1');
    expect(recs).toHaveLength(3);
    expect(new Set(recs.map((r) => `${r.student_id}|${r.date}`)).size).toBe(3);
    expect(recs.every((r) => r.date === '2026-08-31' && r.recorded_by === 'u1')).toBe(true);
    expect(recs.every((r) => r.school_id === 'esc-1')).toBe(true);
    expect(recs.find((r) => r.student_id === 's3')!.status).toBe('absent');
  });

  it('gera fechamento turma+data (usado pelos dois pontos de entrada)', () => {
    const counts = countMarks(list, { s2: 'absent', s3: 'absent' });
    const row = buildClosureRow('26RMM101', '2026-08-31', 'morning', counts, 'u1', 'ts', 'esc-1');

    expect(row).toEqual({
      school_id: 'esc-1',
      class_name: '26RMM101',
      date: '2026-08-31',
      shift: 'morning',
      student_count: 3,
      present_count: 1,
      absent_count: 2,
      closed_by: 'u1',
      updated_at: 'ts',
    });
  });

  it('salvar por Turmas marca a turma como Realizada no status diário', () => {
    const counts = countMarks(list, {});
    const closure = buildClosureRow('26RMM101', '2026-08-31', 'morning', counts, 'u1', 'ts', 'esc-1');
    const rows = buildDailyClassRows(classes, students, [closure], '2026-08-31');
    expect(rows.find((r) => r.name === '26RMM101')!.status).toBe('done');
  });
});

describe('presença global da escola ("Presentes hoje: X de Y alunos — Z%")', () => {
  const D = '2026-08-31';
  /** Turmas da escola: 1A, 2B e 3C ativas; 9Z inativa. */
  const schoolClasses = [
    { id: 'c1', name: '1A', status: 'active' },
    { id: 'c2', name: '2B', status: 'active' },
    { id: 'c3', name: '3C', status: null }, // sem status = ativa
    { id: 'c9', name: '9Z', status: 'inactive' },
  ];
  const valid = activeClassNames(schoolClasses);

  const students = [
    { id: 'a1', class: '1A', status: 'active' },
    { id: 'a2', class: '1A', status: 'active' },
    { id: 'a3', class: '2B', status: 'active' },
    { id: 'a4', class: '2B', status: 'inactive' }, // inativo
    { id: 'a5', class: '3C', status: null }, // sem status = ativo
    { id: 'a6', class: '', status: 'active' }, // sem turma
    { id: 'a7', class: 'TURMA-QUE-NAO-EXISTE', status: 'active' }, // turma inexistente
    { id: 'a8', class: '9Z', status: 'active' }, // turma inativa
  ];

  const present = (id: string, date = D) => ({ student_id: id, status: 'present', date });

  it('activeClassNames devolve só turmas ativas (status ausente = ativa)', () => {
    expect(valid).toEqual(['1A', '2B', '3C']);
  });

  it('Y = ativos com turma válida; inativo, sem turma, turma inexistente e turma inativa ficam fora', () => {
    const p = computeSchoolPresence(students, [], { dateKey: D, validClassNames: valid });
    expect(p.total).toBe(4); // a1, a2, a3, a5
    expect([...validPresenceStudentIds(students, valid)].sort()).toEqual(['a1', 'a2', 'a3', 'a5']);
  });

  it('X = alunos DISTINTOS com present na data; duplicados contam uma vez', () => {
    const p = computeSchoolPresence(students, [present('a1'), present('a1'), present('a1')], {
      dateKey: D, validClassNames: valid,
    });
    expect(p).toEqual({ present: 1, total: 4, percent: 25 });
    expect(formatSchoolPresence(p)).toBe('Presentes hoje: 1 de 4 alunos — 25%');
  });

  it('aluno ativo em turma ativa com present hoje entra em X e em Y', () => {
    const p = computeSchoolPresence(students, [present('a5')], { dateKey: D, validClassNames: valid });
    expect(p.present).toBe(1);
    expect(p.total).toBe(4);
  });

  it('aluno inativo não entra em X nem em Y, mesmo com registro present', () => {
    const p = computeSchoolPresence(students, [present('a4')], { dateKey: D, validClassNames: valid });
    expect(p).toEqual({ present: 0, total: 4, percent: 0 });
  });

  it('aluno sem turma (class vazia/nula) fica fora de X e Y', () => {
    const withNull = [...students, { id: 'a9', class: null as unknown as string, status: 'active' }];
    const p = computeSchoolPresence(withNull, [present('a6'), present('a9')], { dateKey: D, validClassNames: valid });
    expect(p).toEqual({ present: 0, total: 4, percent: 0 });
  });

  it('aluno em turma inexistente na escola fica fora de X e Y', () => {
    const p = computeSchoolPresence(students, [present('a7')], { dateKey: D, validClassNames: valid });
    expect(p).toEqual({ present: 0, total: 4, percent: 0 });
  });

  it('aluno em turma inativa fica fora de X e Y', () => {
    const p = computeSchoolPresence(students, [present('a8')], { dateKey: D, validClassNames: valid });
    expect(p).toEqual({ present: 0, total: 4, percent: 0 });
    // Se a turma volta a ficar ativa, o aluno passa a contar.
    const reactivated = computeSchoolPresence(students, [present('a8')], { dateKey: D, validClassNames: [...valid, '9Z'] });
    expect(reactivated).toEqual({ present: 1, total: 5, percent: 20 });
  });

  it('absent e justified NÃO contam como presença', () => {
    const p = computeSchoolPresence(students, [
      { student_id: 'a1', status: 'absent', date: D },
      { student_id: 'a2', status: 'justified', date: D },
      present('a3'),
    ], { dateKey: D, validClassNames: valid });
    expect(p.present).toBe(1);
  });

  it('registro de outra data é ignorado', () => {
    const p = computeSchoolPresence(students, [present('a1', '2026-08-30'), present('a2', '2026-09-01')], {
      dateKey: D, validClassNames: valid,
    });
    expect(p.present).toBe(0);
  });

  it('registro de aluno de fora da escola (id desconhecido) é ignorado', () => {
    const p = computeSchoolPresence(students, [present('zz')], { dateKey: D, validClassNames: valid });
    expect(p.present).toBe(0);
  });

  it('nome de turma compara com trim/caixa, sem misturar turmas distintas', () => {
    const list = [
      { id: 'b1', class: ' 1a ', status: 'active' },
      { id: 'b2', class: '1AB', status: 'active' }, // outra turma: não é 1A
    ];
    const p = computeSchoolPresence(list, [present('b1'), present('b2')], { dateKey: D, validClassNames: ['1A'] });
    expect(p).toEqual({ present: 1, total: 1, percent: 100 });
  });

  it('Y = 0: percentual 0, exibe "0%" e nunca divide por zero', () => {
    const p = computeSchoolPresence([{ id: 'x', class: '1A', status: 'inactive' }], [present('x')], {
      dateKey: D, validClassNames: valid,
    });
    expect(p).toEqual({ present: 0, total: 0, percent: 0 });
    expect(formatPresencePercent(p.percent)).toBe('0%');
    expect(formatSchoolPresence(p)).toBe('Presentes hoje: 0 de 0 alunos — 0%');
    expect(presenceProgressValue(p.percent)).toBe(0);
    // Escola sem nenhuma turma válida também não quebra.
    expect(computeSchoolPresence(students, [present('a1')], { dateKey: D, validClassNames: [] }))
      .toEqual({ present: 0, total: 0, percent: 0 });
  });

  it('percentual com 1 casa decimal em pt-BR: 1/3 = 33,3%, 2/3 = 66,7%, 2/4 = 50%, 3/3 = 100%', () => {
    const three = students.slice(0, 3);
    const opts = { dateKey: D, validClassNames: valid };
    expect(formatPresencePercent(computeSchoolPresence(three, [present('a1')], opts).percent)).toBe('33,3%');
    expect(formatPresencePercent(computeSchoolPresence(three, [present('a1'), present('a2')], opts).percent)).toBe('66,7%');
    expect(formatPresencePercent(computeSchoolPresence(students, [present('a1'), present('a2')], opts).percent)).toBe('50%');
    const all = computeSchoolPresence(three, three.map((s) => present(s.id)), opts);
    expect(all).toEqual({ present: 3, total: 3, percent: 100 });
    expect(formatPresencePercent(all.percent)).toBe('100%');
  });

  it('X nunca ultrapassa Y', () => {
    const p = computeSchoolPresence(students, students.map((s) => present(s.id)), { dateKey: D, validClassNames: valid });
    expect(p.present).toBeLessThanOrEqual(p.total);
    expect(p).toEqual({ present: 4, total: 4, percent: 100 });
  });

  it('barra de progresso sempre em 0..100 e tolerante a valores inválidos', () => {
    expect(presenceProgressValue(150)).toBe(100);
    expect(presenceProgressValue(-5)).toBe(0);
    expect(presenceProgressValue(NaN)).toBe(0);
    expect(presenceProgressValue(null)).toBe(0);
    expect(presenceProgressValue(33.333)).toBeCloseTo(33.333);
    expect(formatPresencePercent(NaN)).toBe('0%');
    expect(formatPresencePercent(null)).toBe('0%');
  });

  it('a busca/filtro visual de turma não altera o contador global', () => {
    const rows = buildDailyClassRows(
      schoolClasses.filter((c) => (c.status ?? 'active') === 'active'),
      students,
      [],
      D,
    );
    const filtered = filterRowsBySearch(rows, '2b');
    expect(filtered.map((r) => r.name)).toEqual(['2B']);
    expect(filterRowsBySearch(rows, '   ')).toBe(rows);

    // O contador continua recebendo a escola inteira: o mesmo resultado antes e depois do filtro.
    const before = computeSchoolPresence(students, [present('a1'), present('a3')], { dateKey: D, validClassNames: valid });
    const after = computeSchoolPresence(students, [present('a1'), present('a3')], { dateKey: D, validClassNames: valid });
    expect(before).toEqual(after);
    expect(before).toEqual({ present: 2, total: 4, percent: 50 });
  });

  it('sem dateKey aceita registros sem data (consulta já filtrada no banco)', () => {
    const p = computeSchoolPresence(students, [{ student_id: 'a1', status: 'present' }], { validClassNames: valid });
    expect(p.present).toBe(1);
  });

  it('localDateKey perto da meia-noite usa o dia local (00:30 e 23:59:59 do mesmo dia)', () => {
    expect(localDateKey(new Date(2026, 7, 31, 0, 30, 0))).toBe('2026-08-31');
    expect(localDateKey(new Date(2026, 7, 31, 23, 59, 59))).toBe('2026-08-31');
    expect(localDateKey(new Date(2026, 8, 1, 0, 0, 0))).toBe('2026-09-01');
  });
});
