/**
 * Regressão do eixo SEA nos Aprofundamentos (regra global por identidade curricular,
 * nunca por turma). Cobre identidade canônica, reconciliação, parser local e matriz oficial.
 */
import { describe, expect, it } from 'vitest';
import { canonicalSubjectKey, normalizeText } from '../normalize';
import { reconcileLocalWithAi } from '../reconcile';
import { buildCells, detectGrid, groupLines } from '../layout';
import { buildSubjectAnchors, matchSubjectAnchor } from '../subjectAnchors';
import { TextToken } from '../types';
import { APROFUNDAMENTO_AXES, OFFICIAL_CURRICULUM_MATRIX, officialMatrixForSeries } from '@/lib/curriculumMatrixData';

const CANON_I = canonicalSubjectKey('APROFUNDAMENTO IF - I');
const CANON_II = canonicalSubjectKey('APROFUNDAMENTO IF - II');

describe('identidade canônica com todos os eixos', () => {
  it('inclui SEA na lista autorizada', () => {
    expect([...APROFUNDAMENTO_AXES]).toEqual(['CHL', 'CNS', 'ETT', 'SEA']);
  });

  it.each([...APROFUNDAMENTO_AXES])('%s - I/II resolvem os canônicos', (axis) => {
    expect(canonicalSubjectKey(`APROFUNDAMENTO IF - ${axis} - I`)).toBe(CANON_I);
    expect(canonicalSubjectKey(`APROFUNDAMENTO IF ${axis} I`)).toBe(CANON_I);
    expect(canonicalSubjectKey(`APROFUNDAMENTO IF - ${axis} - II`)).toBe(CANON_II);
    expect(canonicalSubjectKey(`aprofundamento if  ${axis}  ii`)).toBe(CANON_II);
  });

  it('I nunca é igual a II', () => {
    expect(CANON_I).not.toBe(CANON_II);
  });

  it('não remove SEA de disciplinas que não são Aprofundamento', () => {
    expect(canonicalSubjectKey('PROJETO SEA')).toBe(normalizeText('PROJETO SEA'));
    expect(canonicalSubjectKey('ELETIVA SEA II')).toBe(normalizeText('ELETIVA SEA II'));
  });
});

describe('reconciliação: SEA da IA casa com o canônico local', () => {
  const local = (subject: string, raw: string, value: number) => ({
    rows: [{ subject, period: '1º Período', raw_value: raw, value, flags: [], source: 'local' }],
    stats: {}, notes: [], reading: { mode: 'local' },
  });

  it('SEA - I 7,50 => match sem divergência', () => {
    const { preview, divergences, aiOnlyNumericIgnored } = reconcileLocalWithAi(
      local('APROFUNDAMENTO IF - I', '7,50', 7.5),
      { rows: [{ subject: 'APROFUNDAMENTO IF - SEA - I', period: '1º Período', raw_value: '7,50', value: 7.5 }] },
    );
    expect(divergences).toBe(0);
    expect(aiOnlyNumericIgnored).toBe(0);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].flags).toContain('reconciled_match');
    expect(preview.rows.some((r) => r.source === 'ai')).toBe(false);
  });

  it('SEA - II 7,00 => match sem divergência', () => {
    const { preview, divergences } = reconcileLocalWithAi(
      local('APROFUNDAMENTO IF - II', '7,00', 7),
      { rows: [{ subject: 'APROFUNDAMENTO IF - SEA - II', period: '1º Período', raw_value: '7,00', value: 7 }] },
    );
    expect(divergences).toBe(0);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].flags).toContain('reconciled_match');
  });

  it('SEA - I da IA nunca casa com o canônico II', () => {
    const { divergences } = reconcileLocalWithAi(
      local('APROFUNDAMENTO IF - II', '7,00', 7),
      { rows: [{ subject: 'APROFUNDAMENTO IF - SEA - I', period: '1º Período', raw_value: '7,00', value: 7 }] },
    );
    expect(divergences).toBeGreaterThan(0);
  });
});

// --- parser local (geometria SIAEP) -------------------------------------------------
const PERIODS = ['1º Período', '2º Período', '3º Período', '4º Período'];
const COLS = [200, 300, 400, 500];
const tk = (text: string, x: number, y: number, w = text.length * 5, h = 9): TextToken => ({ text, x, y, w, h });

interface LineInput { subject?: string; notas?: (string | null)[]; faltas?: (string | null)[] }

function buildTokens(lines: LineInput[]): TextToken[] {
  const tokens: TextToken[] = [tk('Disciplina', 40, 680, 60)];
  PERIODS.forEach((label, i) => tokens.push(tk(label, COLS[i], 680, 60)));
  tokens.push(tk('Média Final', 600, 680, 60));
  COLS.forEach((x) => {
    tokens.push(tk('Nota', x + 5, 665, 25));
    tokens.push(tk('Faltas', x + 40, 665, 30));
  });
  tokens.push(tk('Nota', 605, 665, 25));
  let y = 640;
  lines.forEach((line) => {
    if (line.subject) tokens.push(tk(line.subject, 40, y, 100));
    COLS.forEach((x, i) => {
      const nota = line.notas?.[i] ?? null;
      const falta = line.faltas?.[i] ?? null;
      if (nota != null) tokens.push(tk(nota, x + 10, y, 20));
      if (falta != null) tokens.push(tk(falta, x + 45, y, 18));
    });
    y -= 12;
  });
  return tokens;
}

const anchors = buildSubjectAnchors([
  { name: 'APROFUNDAMENTO IF - I', weekly_classes: 2, aliases: [] },
  { name: 'APROFUNDAMENTO IF - II', weekly_classes: 2, aliases: [] },
  { name: 'MATEMATICA', weekly_classes: 4, aliases: [] },
]);

const build = (lines: LineInput[]) => {
  const grouped = groupLines(buildTokens(lines));
  const grid = detectGrid(grouped);
  expect(grid).not.toBeNull();
  return buildCells(grouped, grid!, anchors);
};
const cellOf = (res: ReturnType<typeof build>, subject: string, period: string) =>
  res.cells.find((c) => c.subject === subject && c.period === period);

describe('parser local com eixo SEA', () => {
  it('materializa o canônico I e mantém null != 0, descartando faltas', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - SEA - I', notas: ['7,50', null, null, null], faltas: ['12', '4', null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - I']);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '1º Período')?.value).toBe(7.5);
    expect(cellOf(res, 'APROFUNDAMENTO IF - I', '2º Período')?.value).toBeNull();
    expect(res.cells.some((c) => c.value === 12 || c.value === 4)).toBe(false);
  });

  it('materializa o canônico II', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - SEA - II', notas: ['7,00', null, null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - II']);
    expect(cellOf(res, 'APROFUNDAMENTO IF - II', '1º Período')?.value).toBe(7);
  });

  it('nome quebrado com SEA em duas linhas continua funcionando', () => {
    const res = build([
      { subject: 'APROFUNDAMENTO IF - SEA -' },
      { subject: 'II', notas: ['8,00', '7,50', null, null] },
    ]);
    expect(res.subjects).toEqual(['APROFUNDAMENTO IF - II']);
    expect(cellOf(res, 'APROFUNDAMENTO IF - II', '1º Período')?.value).toBe(8);
    expect(cellOf(res, 'APROFUNDAMENTO IF - II', '2º Período')?.value).toBe(7.5);
  });

  it('âncora reconhece SEA em 2º e 3º ano', () => {
    (['2', '3'] as const).forEach((series) => {
      const seriesAnchors = buildSubjectAnchors(
        officialMatrixForSeries(series).map((s) => ({
          name: s.name, aliases: s.aliases, abbreviation: s.abbreviation, weekly_classes: s.weekly_classes,
        })),
      );
      APROFUNDAMENTO_AXES.forEach((axis) => {
        expect(matchSubjectAnchor(`APROFUNDAMENTO IF - ${axis} - I`, seriesAnchors)?.anchor.canonical)
          .toBe('APROFUNDAMENTO IF - I');
        expect(matchSubjectAnchor(`APROFUNDAMENTO IF - ${axis} - II`, seriesAnchors)?.anchor.canonical)
          .toBe('APROFUNDAMENTO IF - II');
      });
    });
  });
});

describe('matriz oficial', () => {
  it('aliases de I e II cobrem os quatro eixos', () => {
    (['I', 'II'] as const).forEach((roman) => {
      const subject = OFFICIAL_CURRICULUM_MATRIX.find((s) => s.name === `APROFUNDAMENTO IF - ${roman}`);
      expect(subject).toBeDefined();
      APROFUNDAMENTO_AXES.forEach((axis) => {
        expect(subject!.aliases).toContain(`APROFUNDAMENTO IF - ${axis} - ${roman}`);
        expect(subject!.aliases).toContain(`APROFUNDAMENTO IF ${axis} ${roman}`);
      });
    });
  });

  it('séries 2 e 3 contêm Aprofundamento I e II com 2 aulas semanais', () => {
    (['2', '3'] as const).forEach((series) => {
      const names = officialMatrixForSeries(series);
      ['APROFUNDAMENTO IF - I', 'APROFUNDAMENTO IF - II'].forEach((name) => {
        const found = names.find((s) => s.name === name);
        expect(found?.weekly_classes).toBe(2);
        expect(found?.include_in_ira).toBe(true);
      });
    });
  });
});
