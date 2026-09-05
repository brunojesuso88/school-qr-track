/**
 * Reconstrução REAL de duas linhas do PDF para a disciplina
 * "ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS":
 *   linha N   -> "... DO TURISMO DE"
 *   linha N+1 -> "EVENTOS" + as notas dos períodos.
 *
 * Prova leitura LOCAL (tokens/coordenadas) e que a IA não é acionada quando o
 * restante da página é conclusivo.
 */
import { describe, expect, it } from 'vitest';
import { buildCells, detectGrid, groupLines } from '../layout';
import { buildSubjectAnchors } from '../subjectAnchors';
import { LocalExpectedSubject, TextToken } from '../types';
import { decideAiFallback } from '@/lib/gradeImport/aiPolicy';

const PERIODS = ['1º Período', '2º Período', '3º Período', '4º Período'];
const COLS = [200, 300, 400, 500];
const LINE_STEP = 12;
const CANONICAL = 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS';

const tk = (text: string, x: number, y: number, w = text.length * 5, h = 9): TextToken => ({ text, x, y, w, h });

const expected = (names: string[]): LocalExpectedSubject[] => names.map((name, i) => ({
  name, slot_index: 1, weekly_classes: 0, aliases: [], abbreviation: null, sort_order: i,
} as LocalExpectedSubject));

const anchors = buildSubjectAnchors(expected([
  CANONICAL,
  'GESTAO DE EVENTOS: PLANEJAMENTO E EXECUCAO',
  'MARKETING EM EVENTOS',
]));

interface LineInput { subject?: string; notas?: (string | null)[] }

const buildTokens = (lines: LineInput[]): TextToken[] => {
  const tokens: TextToken[] = [tk('Disciplina', 40, 680, 60)];
  PERIODS.forEach((label, i) => tokens.push(tk(label, COLS[i], 680, 60)));
  COLS.forEach((x) => {
    tokens.push(tk('Nota', x + 5, 665, 25));
    tokens.push(tk('Faltas', x + 40, 665, 30));
  });
  let y = 640;
  lines.forEach((line) => {
    if (line.subject) tokens.push(tk(line.subject, 40, y, 100));
    COLS.forEach((x, i) => {
      const nota = line.notas?.[i] ?? null;
      if (nota != null) tokens.push(tk(nota, x + 10, y, 20));
    });
    y -= LINE_STEP;
  });
  return tokens;
};

const read = (lines: LineInput[]) => {
  const grouped = groupLines(buildTokens(lines));
  const grid = detectGrid(grouped);
  expect(grid).not.toBeNull();
  return buildCells(grouped, grid!, anchors);
};

describe('ASPECTOS CULTURAIS ... TURISMO DE EVENTOS em duas linhas', () => {
  const result = read([
    { subject: 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE' },
    { subject: 'EVENTOS', notas: ['8,00', '7,50', '9,00', null] },
    { subject: 'MARKETING EM EVENTOS', notas: ['6,00', null, null, null] },
  ]);

  it('reconstrói a disciplina canônica com o espaço correto', () => {
    const subjects = [...new Set(result.cells.map((c) => c.subject))];
    expect(subjects).toContain(CANONICAL);
    expect(subjects.some((s) => s.includes('DEEVENTOS'))).toBe(false);
  });

  it('mantém as notas nos períodos corretos', () => {
    const cellOf = (period: string) => result.cells.find((c) => c.subject === CANONICAL && c.period === period);
    expect(cellOf('1º Período')?.raw).toBe('8,00');
    expect(cellOf('2º Período')?.raw).toBe('7,50');
    expect(cellOf('3º Período')?.raw).toBe('9,00');
    expect(cellOf('4º Período')?.raw ?? null).toBeNull();
    expect(result.cells.find((c) => c.subject === 'MARKETING EM EVENTOS' && c.period === '1º Período')?.raw).toBe('6,00');
  });

  it('não aciona a IA quando a página é conclusiva', () => {
    const decision = decideAiFallback(
      {
        ok: true,
        authoritative: true,
        preview: { page: 1 },
        validation: { reasons: [], blockers: [], conclusive: true, score: 1 },
        reading: { blockers: [] },
      },
      { mode: 'local_ai', hasLocalDocument: true },
    );
    expect(decision.useAi).toBe(false);
    expect(decision.origin).toBe('local_conclusive');
  });
});
