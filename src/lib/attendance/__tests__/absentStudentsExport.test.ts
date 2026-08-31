import { describe, it, expect } from 'vitest';
import { buildAbsentLines } from '../absentStudentsExport';

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
