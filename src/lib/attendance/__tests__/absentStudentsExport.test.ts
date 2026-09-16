import { describe, it, expect } from 'vitest';
import { buildAbsentLines, absentRowsFromAttendance } from '../absentStudentsExport';

describe('buildAbsentLines', () => {
  const rows = [
    { id: 'a', name: 'ANA' },
    { id: 'b', name: 'BRUNO' },
  ];

  it('marca alunos com atestado ativo na data', () => {
    const coverage = new Set(['a|2026-08-31']);
    expect(buildAbsentLines(rows, coverage, '2026-08-31')).toEqual(['ANA — Atestado', 'BRUNO']);
  });

  it('não marca quando não há cobertura', () => {
    expect(buildAbsentLines(rows, new Set(), '2026-08-31')).toEqual(['ANA', 'BRUNO']);
  });
});

describe('absentRowsFromAttendance', () => {
  const attendance = [
    { student_id: 'a', status: 'absent', students: { full_name: 'ANA', class: '1A' } },
    { student_id: 'b', status: 'justified', students: { full_name: 'BRUNO', class: '1A' } },
    { student_id: 'c', status: 'present', students: { full_name: 'CARLA', class: '1A' } },
    { student_id: 'd', status: 'absent', students: { full_name: 'DAVI', class: '2B' } },
  ];

  it('justificada NÃO entra na lista de faltosos', () => {
    expect(absentRowsFromAttendance(attendance, '1A')).toEqual([{ id: 'a', name: 'ANA' }]);
  });

  it('respeita a turma solicitada', () => {
    expect(absentRowsFromAttendance(attendance, '2B')).toEqual([{ id: 'd', name: 'DAVI' }]);
  });
});
