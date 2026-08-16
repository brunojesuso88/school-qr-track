/**
 * Fase 3 — requisitos centrais:
 * matriz curricular como âncora determinística, série canônica ('1'|'2'|'3'),
 * null != 0, faltas/colunas finais ignoradas e reconciliação sem falsas divergências.
 */
import { describe, expect, it } from 'vitest';
import { buildCells, detectGrid, groupLines } from '../layout';
import { buildSubjectAnchors, matchSubjectAnchor } from '../subjectAnchors';
import {
  buildEffectiveSubjectMatrix, selectMissingSeriesMatrixSubjects,
} from '../effectiveMatrix';
import { reconcileLocalWithAi } from '../reconcile';
import { TextToken } from '../types';
import { CLASS_SERIES_OPTIONS, normalizeSeriesList, parseSeriesValue } from '../../series';

/** Disciplinas REAIS da turma 26RMM-CNS-300 citadas na auditoria. */
const TARGET_SUBJECTS = [
  'APROFUNDAMENTO IF - CNS - I',
  'FILOSOFIA',
  'HISTORIA',
  'IDENTIDADE E PROTAGONISMO',
];

const PERIODS = ['1º Período', '2º Período', '3º Período', '4º Período'];
const COLS = [200, 300, 400, 500];
const FINAL_COL = 600;

const tk = (text: string, x: number, y: number, w = text.length * 5, h = 9): TextToken =>
  ({ text, x, y, w, h });

interface RowInput {
  /** nome na coluna de disciplina; array => nome quebrado em duas linhas */
  subject: string | [string, string];
  notas?: (string | null)[];
  faltas?: (string | null)[];
  final?: string | null;
}

/** Monta a página: cabeçalho de períodos + Nota/Faltas + coluna final ignorada. */
function buildTokens(rows: RowInput[]): TextToken[] {
  const tokens: TextToken[] = [tk('Disciplina', 40, 680, 60)];
  PERIODS.forEach((label, i) => tokens.push(tk(label, COLS[i], 680, 60)));
  tokens.push(tk('Média Final', FINAL_COL, 680, 60));
  COLS.forEach((x) => {
    tokens.push(tk('Nota', x + 5, 665, 25));
    tokens.push(tk('Faltas', x + 40, 665, 30));
  });
  tokens.push(tk('Nota', FINAL_COL + 5, 665, 25));

  let y = 640;
  rows.forEach((row) => {
    const names = Array.isArray(row.subject) ? row.subject : [row.subject];
    names.forEach((part, idx) => tokens.push(tk(part, 40, y - idx * 12, 100)));
    const baseY = y - (names.length - 1) * 12;
    COLS.forEach((x, i) => {
      const nota = row.notas?.[i] ?? null;
      const falta = row.faltas?.[i] ?? null;
      if (nota != null) tokens.push(tk(nota, x + 10, baseY, 20));
      if (falta != null) tokens.push(tk(falta, x + 45, baseY, 18));
    });
    if (row.final != null) tokens.push(tk(row.final, FINAL_COL + 10, baseY, 20));
    y = baseY - 22;
  });
  return tokens;
}

const anchors = buildSubjectAnchors([
  ...TARGET_SUBJECTS.map((name) => ({ name, weekly_classes: 2 })),
  { name: 'Língua Portuguesa', aliases: ['LINGUA PORTUGUESA', 'Português'], abbreviation: 'LP' },
  { name: 'Matemática', aliases: [], abbreviation: 'MAT' },
]);

const build = (rows: RowInput[], anchorList = anchors) => {
  const lines = groupLines(buildTokens(rows));
  const grid = detectGrid(lines);
  expect(grid).not.toBeNull();
  return buildCells(lines, grid!, anchorList);
};

describe('Fase 3 — parser local com âncoras curriculares', () => {
  it('fixture real: 4 disciplinas sem nenhuma nota => 16 células null ancoradas', () => {
    const result = build(TARGET_SUBJECTS.map((subject) => ({ subject })));
    expect(result.cells).toHaveLength(16);
    expect(result.cells.every((c) => c.raw_value === null && c.value === null)).toBe(true);
    expect(result.cells.every((c) => c.anchored === true)).toBe(true);
    expect(result.cells.some((c) => c.value === 0)).toBe(false);
    expect([...new Set(result.anchoredSubjects)].sort()).toEqual([...TARGET_SUBJECTS].sort());
  });

  it('nome de disciplina quebrado em duas linhas é fundido e gera 4 células null', () => {
    // Fragmento inicial ambíguo (duas trilhas de aprofundamento): só a fusão resolve.
    const twoTracks = buildSubjectAnchors([
      { name: 'APROFUNDAMENTO IF - CNS - I', weekly_classes: 2 },
      { name: 'APROFUNDAMENTO IF - CNS - II', weekly_classes: 2 },
    ]);
    expect(matchSubjectAnchor('APROFUNDAMENTO IF -', twoTracks)).toBeNull();
    const result = build([{ subject: ['APROFUNDAMENTO IF -', 'CNS - I'] }], twoTracks);
    expect(result.mergedSubjectLines).toBeGreaterThan(0);
    expect(result.cells).toHaveLength(4);
    expect(result.cells.every((c) => c.value === null && c.anchored === true)).toBe(true);
    expect(result.anchoredSubjects).toContain('APROFUNDAMENTO IF - CNS - I');
  });

  it('0,00 permanece zero real (nunca vira vazio)', () => {
    const result = build([{ subject: 'FILOSOFIA', notas: ['0,00', null, null, null] }]);
    const first = result.cells.find((c) => c.period === '1º Período');
    expect(first?.value).toBe(0);
    expect(first?.raw_value).toBe('0,00');
    expect(result.cells.filter((c) => c.value === null)).toHaveLength(3);
  });

  it('faltas e coluna final continuam ignoradas', () => {
    const result = build([{
      subject: 'HISTORIA',
      notas: ['7,00', null, null, null],
      faltas: ['4', '6', '8', '2'],
      final: '9,90',
    }]);
    expect(result.droppedAbsenceTokens).toBeGreaterThan(0);
    expect(result.cells.map((c) => c.raw_value)).toEqual(['7,00', null, null, null]);
    expect(result.cells.some((c) => c.raw_value === '9,90')).toBe(false);
    expect(result.cells.some((c) => /final/i.test(c.period))).toBe(false);
  });
});

describe('Fase 3 — reconhecimento de âncoras', () => {
  it('alias Português <-> LINGUA PORTUGUESA funciona nos dois sentidos', () => {
    expect(matchSubjectAnchor('Português', anchors)?.anchor.canonical).toBe('Língua Portuguesa');
    expect(matchSubjectAnchor('LINGUA PORTUGUESA', anchors)?.anchor.canonical).toBe('Língua Portuguesa');
  });

  it('abreviação inequívoca ancora', () => {
    expect(matchSubjectAnchor('MAT', anchors)?.kind).toBe('abbreviation');
  });

  it('ambiguidade entre 2+ candidatos NÃO ancora', () => {
    const ambiguous = buildSubjectAnchors([
      { name: 'HISTORIA', abbreviation: 'HIS' },
      { name: 'HISTORIA DA ARTE', abbreviation: 'HIS' },
    ]);
    expect(matchSubjectAnchor('HIS', ambiguous)).toBeNull();
    expect(matchSubjectAnchor('HISTORIA D', ambiguous)).toBeNull();
  });
});

const localRow = (subject: string, period: string, raw: string | null, value: number | null) =>
  ({ subject, period, raw_value: raw, value, flags: [] as string[] });

describe('Fase 3 — reconciliação local × IA', () => {
  it('fixture real: 16 células locais null + IA vazia => zero divergências', () => {
    const rows = TARGET_SUBJECTS.flatMap((s) => PERIODS.map((p) => localRow(s, p, null, null)));
    const ai = { rows: TARGET_SUBJECTS.flatMap((s) => PERIODS.map((p) => localRow(s, p, '—', null))) };
    const out = reconcileLocalWithAi({ rows }, ai);
    expect(rows).toHaveLength(16);
    expect(out.divergences).toBe(0);
    expect(out.aiEmptyIgnored).toBe(0);
    expect((out.preview as { rows: { flags: string[] }[] }).rows.every((r) => r.flags.includes('reconciled_match'))).toBe(true);
  });

  it('célula vazia só da IA é descartada e não bloqueia', () => {
    const out = reconcileLocalWithAi(
      { rows: [localRow('FILOSOFIA', '1º Período', null, null)] },
      { rows: [localRow('FILOSOFIA', '1º Período', null, null), localRow('SOCIOLOGIA', '1º Período', '—', null)] },
    );
    expect(out.aiEmptyIgnored).toBe(1);
    expect(out.divergences).toBe(0);
    expect((out.preview as { rows: unknown[] }).rows).toHaveLength(1);
  });

  it('célula numérica só da IA gera divergência bloqueante', () => {
    const out = reconcileLocalWithAi(
      { rows: [localRow('FILOSOFIA', '1º Período', null, null)] },
      { rows: [localRow('SOCIOLOGIA', '1º Período', '8,00', 8)] },
    );
    expect(out.divergences).toBe(1);
    expect(out.aiEmptyIgnored).toBe(0);
  });

  it('número local diferente do da IA gera divergência real preservando o valor local', () => {
    const out = reconcileLocalWithAi(
      { rows: [localRow('HISTORIA', '1º Período', '7,00', 7)] },
      { rows: [localRow('HISTORIA', '1º Período', '9,00', 9)] },
    );
    expect(out.divergences).toBe(1);
    const row = (out.preview as { rows: { value: number; second_pass_value: string; flags: string[] }[] }).rows[0];
    expect(row.value).toBe(7);
    expect(row.second_pass_value).toBe('9,00');
    expect(row.flags).toContain('reconciliation_divergence');
  });
});

describe('Fase 3 — série canônica 1/2/3', () => {
  it('valor persistido é 1/2/3 e o rótulo é "Nº ano do Ensino Médio"', () => {
    expect(CLASS_SERIES_OPTIONS.map((o) => o.value)).toEqual(['1', '2', '3']);
    expect(CLASS_SERIES_OPTIONS.map((o) => o.label)).toEqual([
      '1º ano do Ensino Médio', '2º ano do Ensino Médio', '3º ano do Ensino Médio',
    ]);
  });

  it('rótulos legados são aceitos apenas na leitura e normalizados para 1/2/3', () => {
    expect(parseSeriesValue('1')).toBe('1');
    expect(parseSeriesValue('1º ano')).toBe('1');
    expect(parseSeriesValue('2ª Série do Ensino Médio')).toBe('2');
    expect(parseSeriesValue('3º ano do Ensino Médio')).toBe('3');
    expect(parseSeriesValue('sem série')).toBeNull();
    expect(normalizeSeriesList(['3º ano', '1', 'lixo'])).toEqual(['1', '3']);
  });

  it('matriz efetiva da série 1 inclui só catálogo da série 1', () => {
    const catalog = [
      { name: 'Filosofia', series: ['1'], default_weekly_classes: 1 },
      { name: 'Sociologia', series: ['2'], default_weekly_classes: 1 },
      { name: 'Projeto de Vida', series: ['1', '3'], default_weekly_classes: 2 },
    ];
    const matrix = buildEffectiveSubjectMatrix({ mapping: [{ name: 'HISTORIA', weekly_classes: 2 }], catalog, series: '1' });
    expect(matrix.map((m) => m.name).sort()).toEqual(['Filosofia', 'HISTORIA', 'Projeto de Vida']);
  });

  it('turma sem série definida não herda o catálogo (só mapeamento e importadas)', () => {
    const matrix = buildEffectiveSubjectMatrix({
      mapping: [{ name: 'HISTORIA', weekly_classes: 2 }],
      imported: [{ name: 'FILOSOFIA', weekly_classes: 1 }],
      catalog: [{ name: 'Sociologia', series: ['1'] }],
      series: null,
    });
    expect(matrix.map((m) => m.name).sort()).toEqual(['FILOSOFIA', 'HISTORIA']);
  });

  it('aplicar matriz da série preserva disciplina extra e carga horária existente', () => {
    const catalog = [
      { name: 'FILOSOFIA', series: ['1'], default_weekly_classes: 1 },
      { name: 'HISTORIA', series: ['1'], default_weekly_classes: 2 },
      { name: 'SOCIOLOGIA', series: ['2'], default_weekly_classes: 1 },
    ];
    const existing = [{ subject_name: 'HISTORIA' }, { subject_name: 'APROFUNDAMENTO IF - CNS - I' }];
    const missing = selectMissingSeriesMatrixSubjects('1', catalog, existing);
    expect(missing.map((m) => m.name)).toEqual(['FILOSOFIA']);
    // nenhuma disciplina existente é tocada nem removida
    expect(missing.some((m) => m.name === 'HISTORIA')).toBe(false);
    expect(missing.some((m) => m.name === 'APROFUNDAMENTO IF - CNS - I')).toBe(false);
  });
});
