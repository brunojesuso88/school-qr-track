/**
 * Nomes LONGOS da Matriz Integral quebrados em duas linhas no PDF e a distinção
 * obrigatória entre "DA" e "DE".
 *
 * Tudo aqui prova LEITURA LOCAL (`buildCells`), sem qualquer participação da IA:
 * a disciplina canônica e as notas saem do texto/coordenadas do PDF.
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
  subject?: string;
  notas?: (string | null)[];
}

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
      if (nota != null) tokens.push(tk(nota, x + 10, y, 20));
    });
    y -= LINE_STEP;
  });
  return tokens;
}

/** Componentes reais da Matriz Integral (percursos EPT/EVE/SEC) + par DA/DE. */
const anchors = buildSubjectAnchors([
  { name: 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES' },
  { name: 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS' },
  { name: 'RELACOES INTERPESSOAIS E TECNICAS DE ATENDIMENTO' },
  { name: 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS' },
  { name: 'CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO' },
  { name: 'FUNDAMENTOS DA EDUCACAO FINANCEIRA' },
  { name: 'FUNDAMENTOS DE EDUCACAO FINANCEIRA' },
]);

const build = (lines: LineInput[]) => {
  const grouped = groupLines(buildTokens(lines));
  const grid = detectGrid(grouped);
  expect(grid).not.toBeNull();
  return buildCells(grouped, grid!, anchors);
};

const cellOf = (res: ReturnType<typeof build>, subject: string, period: string) =>
  res.cells.find((c) => c.subject === subject && c.period === period);

describe('nomes longos da Matriz Integral quebrados em duas linhas', () => {
  const cases: { id: string; first: string; second: string; canonical: string; notas: (string | null)[] }[] = [
    {
      id: 'a',
      first: 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS',
      second: 'E EQUIPES',
      canonical: 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES',
      notas: ['8,00', '7,50', null, null],
    },
    {
      id: 'b',
      first: 'PLANEJAMENTO, CAPTACAO E EXECUCAO',
      second: 'DE RECURSOS',
      canonical: 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS',
      notas: ['9,00', null, null, null],
    },
    {
      id: 'c',
      first: 'RELACOES INTERPESSOAIS E TECNICAS',
      second: 'DE ATENDIMENTO',
      canonical: 'RELACOES INTERPESSOAIS E TECNICAS DE ATENDIMENTO',
      notas: ['6,50', '7,00', null, null],
    },
    {
      id: 'd',
      first: 'DECORACAO DE AMBIENTES E INTERIORES',
      second: 'PARA EVENTOS',
      canonical: 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS',
      notas: ['10,00', null, null, null],
    },
    {
      id: 'e',
      first: 'CRIATIVIDADE E INOVACAO NO',
      second: 'EMPREENDEDORISMO',
      canonical: 'CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO',
      notas: ['5,00', '8,00', null, null],
    },
  ];

  cases.forEach((c) => {
    it(`${c.id}) "${c.first}" + "${c.second}" lidos localmente com as notas`, () => {
      const res = build([
        { subject: c.first },
        { subject: c.second, notas: c.notas },
      ]);
      expect(res.subjects).toEqual([c.canonical]);
      c.notas.forEach((raw, i) => {
        const cell = cellOf(res, c.canonical, PERIODS[i]);
        if (raw == null) {
          expect(cell?.value ?? null).toBeNull();
        } else {
          expect(cell?.value).toBe(Number(raw.replace(',', '.')));
        }
      });
    });
  });
});

describe('DA nunca vira DE (nem por similaridade)', () => {
  it('mantém duas disciplinas distintas com notas diferentes', () => {
    const res = build([
      { subject: 'FUNDAMENTOS DA EDUCACAO FINANCEIRA', notas: ['7,00', null, null, null] },
      { subject: 'FUNDAMENTOS DE EDUCACAO FINANCEIRA', notas: ['4,00', null, null, null] },
    ]);
    expect(res.subjects).toEqual([
      'FUNDAMENTOS DA EDUCACAO FINANCEIRA',
      'FUNDAMENTOS DE EDUCACAO FINANCEIRA',
    ]);
    expect(cellOf(res, 'FUNDAMENTOS DA EDUCACAO FINANCEIRA', '1º Período')?.value).toBe(7);
    expect(cellOf(res, 'FUNDAMENTOS DE EDUCACAO FINANCEIRA', '1º Período')?.value).toBe(4);
  });

  it('teste negativo: linha com DA não é atribuída ao componente DE', () => {
    const res = build([
      { subject: 'FUNDAMENTOS DA EDUCACAO FINANCEIRA', notas: ['7,00', null, null, null] },
    ]);
    expect(res.subjects).toEqual(['FUNDAMENTOS DA EDUCACAO FINANCEIRA']);
    expect(cellOf(res, 'FUNDAMENTOS DE EDUCACAO FINANCEIRA', '1º Período')).toBeUndefined();
  });
});
