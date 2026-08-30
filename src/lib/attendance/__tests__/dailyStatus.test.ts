import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  isWeekend,
  countActiveStudents,
  buildDailyClassRows,
  summarizeDaily,
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

describe('isWeekend', () => {
  it('detecta sábado e domingo', () => {
    expect(isWeekend(new Date(2026, 7, 29))).toBe(true); // sábado
    expect(isWeekend(new Date(2026, 7, 30))).toBe(true); // domingo
    expect(isWeekend(new Date(2026, 7, 31))).toBe(false); // segunda
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
