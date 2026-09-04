/**
 * Regressões de continuidade de linha no parser local (`buildCells`).
 * Cenário real: "APROFUNDAMENTO IF - CNS - I" quebrado em duas linhas do PDF.
 * Regras: canônico sem eixo, I != II, números órfãos nunca herdam disciplina,
 * subcoluna Faltas sempre descartada e null != 0.
 */
import { describe, expect, it } from 'vitest';
import { buildCells, detectGrid, groupLines } from '../layout';
import { buildSubjectAnchors } from '../subjectAnchors';
import { TextToken } from '../types';

const PERIODS = ['1º Período', '2º Período', '3º Período', '4º Período'];
const COLS = [200, 300, 400, 500];
const FINAL_COL = 600;
const LINE_STEP = 12;

const tk = (text: string, x: number, y: number, w = text.length * 5, h = 9): TextToken =>
  ({ text, x, y, w, h });

interface LineInput {
  /** texto na coluna de disciplina (vazio => linha só com valores) */
  subject?: string;
  notas?: (string | null)[];
  faltas?: (string | null)[];
}

/** Cabeçalho (períodos + Nota/Faltas + coluna final ignorada) e linhas na geometria SIAEP. */
function buildTokens(lines: LineInput[]): TextToken[] {
  const tokens: TextToken[] = [tk('Disciplina', 40, 680, 60)];
  PERIODS.forEach((label, i) => tokens.push(tk(label, COLS[i], 680, 60)));
  tokens.push(tk('Média Final', FINAL_COL, 680, 60));
  COLS.forEach((x) => {
    tokens.push(tk('Nota', x + 5, 665, 25));
    tokens.push(tk('Faltas', x + 40, 665, 30));
  });
  tokens.push(tk('Nota', FINAL_COL + 5, 665, 25));

  let y = 640;
  lines.forEach((line) => {
    if (line.subject) tokens.push(tk(line.subject, 40, y, 100));
    COLS.forEach((x, i) => {
      const nota = line.notas?.[i] ?? null;
      const falta = line.faltas?.[i] ?? null;
      if (nota != null) tokens.push(tk(nota, x + 10, y, 20));
      if (falta != null) tokens.push(tk(falta, x + 45, y, 18));
    });
    y -= LINE_STEP;
  });
  return tokens;
}

const anchors = buildSubjectAnchors([
  { name: 'APROFUNDAMENTO IF - I', weekly_classes: 2 },
  { name: 'APROFUNDAMENTO IF - II', weekly_classes: 2 },
  { name: 'FILOSOFIA', weekly_classes: 1 },
  { name: 'MATEMATICA', weekly_classes: 4 },
]);

const build = (lines: LineInput[]) => {
  const grouped = groupLines(buildTokens(lines));
  const grid = detectGrid(grouped);
  expect(grid).not.toBeNull();
  return buildCells(grouped, grid!, anchors);
};

const cellOf = (res: ReturnType<typeof build>, subject: string, period: string) =>
  res.cells.find((c) => c.subject === subject && c.period === period);

describe('continuidade de nome de disciplina quebrado em duas linhas', () => {
  it('A) nome quebrado antes das notas: "... - CNS -" + "I" com 8,00 e 7,50', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - CNS -' },
      { subject: 'I', notas: ['8,00', '7,50', null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - I']);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '1º Período')?.value).toBe(8);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '2º Período')?.value).toBe(7.5);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '3º Período')?.value).toBeNull();
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '3º Período')?.raw_value).toBeNull();
    expect(res.mergedSubjectLines).toBe(1);
    expect(res.cells).toHaveLength(4);
  });

  it('B) nome completo numa linha e notas na linha seguinte, sem texto de disciplina', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - CNS - I' },
      { notas: ['8,00', '7,50', null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - I']);
    expect(res.anchoredSubjects).toEqual([]);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '1º Período')?.value).toBe(8);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '2º Período')?.value).toBe(7.5);
    expect(res.cells).toHaveLength(4);
  });

  it('C) mesma continuidade preserva o canônico II', () => {
    const quebrado = build([
      { subject: 'APROFUNDAMENTO IF - ETT -' },
      { subject: 'II', notas: ['8,00', '7,50', null, null] },
    ]);
    expect(quebrado.subjects).toEqual(['APROFUNDAMENTO IF - II']);
    expect(cellOf(quebrado, 'APROFUNDAMENTO IF - II', '2º Período')?.value).toBe(7.5);

    const notasAbaixo = build([
      { subject: 'APROFUNDAMENTO IF - CHL - II' },
      { notas: ['9,00', null, null, null] },
    ]);
    expect(notasAbaixo.subjects).toEqual(['APROFUNDAMENTO IF - II']);
    expect(cellOf(notasAbaixo, 'APROFUNDAMENTO IF - II', '1º Período')?.value).toBe(9);
  });

  it('D) pendente sem âncora + linha só de números não gera disciplina alguma', () => {
    const res = build([
      { subject: 'OBSERVACOES DO CONSELHO XPTO' },
      { notas: ['8,00', '7,50', null, null] },
    ]);
    expect(res.subjects).toEqual([]);
    expect(res.cells).toEqual([]);
  });

  it('E) na continuidade, tokens da subcoluna Faltas continuam descartados', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - CNS -' },
      { subject: 'I', notas: ['8,00', '7,50', null, null], faltas: ['6,00', '4,00', null, null] },
    ]);
    expect(res.droppedAbsenceTokens).toBe(2);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '1º Período')?.raw_value).toBe('8,00');
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '2º Período')?.raw_value).toBe('7,50');
  });
});

describe('proteções do pendente', () => {
  it('pendente consumido não vaza para a disciplina seguinte', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - CNS -' },
      { subject: 'I', notas: ['8,00', '7,50', null, null] },
      { subject: 'FILOSOFIA', notas: ['5,00', null, null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - I', 'FILOSOFIA']);
    expect(cellOf(res, 'FILOSOFIA', '1º Período')?.value).toBe(5);
    expect(res.cells).toHaveLength(8);
  });

  it('disciplina da matriz sem nenhuma nota entra vazia (null) e não duplica', () => {
    const res = build([
      { subject: 'FILOSOFIA' },
      { subject: 'MATEMATICA', notas: ['7,00', null, null, null] },
    ]);
    expect(res.subjects).toEqual(['FILOSOFIA', 'MATEMATICA']);
    expect(res.anchoredSubjects).toEqual(['FILOSOFIA']);
    expect(res.cells.filter((c) => c.subject === 'FILOSOFIA').every((c) => c.value === null)).toBe(true);
    expect(res.cells).toHaveLength(8);
  });

  it('disciplinas normais seguem lidas sem fusão indevida', () => {
    const res = build([
      { subject: 'MATEMATICA', notas: ['0,00', '10,00', null, '3,50'] },
      { subject: 'FILOSOFIA', notas: ['6,00', null, null, null] },
    ]);
    expect(res.mergedSubjectLines).toBe(0);
    expect(cellOf(res, 'MATEMATICA', '1º Período')?.value).toBe(0);
    expect(cellOf(res, 'MATEMATICA', '2º Período')?.value).toBe(10);
    expect(cellOf(res, 'MATEMATICA', '3º Período')?.value).toBeNull();
    expect(cellOf(res, 'MATEMATICA', '4º Período')?.value).toBe(3.5);
  });
});
