/**
 * Ocorrências repetidas (slots) do MESMO componente na MESMA etapa são legítimas
 * na Matriz Integral: não podem virar `conflicting_duplicate` (o que derrubaria a
 * autoridade da leitura local e chamaria a IA sem necessidade).
 */
import { describe, expect, it } from 'vitest';
import { validateLocalPage } from '../validate';
import { LocalCell, TextToken } from '../types';

const NAME = 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS';

const cell = (slot: number, raw: string, value: number): LocalCell => ({
  subject: NAME,
  slot,
  period: '1º Período',
  raw_value: raw,
  value,
  confidence: 0.99,
  invalid: false,
});

const tokens: TextToken[] = Array.from({ length: 60 }, (_, i) => ({
  text: `t${i}`, x: i, y: i, width: 5, height: 5,
} as TextToken));

const grid = {
  columns: [{ label: '1º Período', kind: 'period', x0: 0, x1: 10 }],
} as never;

const run = (cells: LocalCell[]) =>
  validateLocalPage({
    tokens,
    grid,
    cells,
    subjects: [NAME],
    expectedSubjects: [],
    ambiguousCells: 0,
    orphanTokens: 0,
    studentName: 'ALUNO TESTE',
    matchScore: 1,
  });

describe('duplicidade por slot na validação local', () => {
  it('dois slots do mesmo componente com valores diferentes NÃO são conflito', () => {
    const res = run([cell(1, '8,00', 8), cell(2, '6,00', 6)]);
    expect(res.blockers).not.toContain('conflicting_duplicate');
  });

  it('mesma disciplina, mesmo slot e mesma etapa com valores diferentes segue conflito', () => {
    const res = run([cell(1, '8,00', 8), cell(1, '6,00', 6)]);
    expect(res.blockers).toContain('conflicting_duplicate');
  });
});
