/**
 * Boletim MULTIPÁGINA POR ALUNO (Matriz Integral e demais matrizes):
 * o mesmo aluno pode ocupar várias páginas do PDF, e páginas de continuação
 * SEM nenhuma disciplina reconhecida são ignoradas em silêncio (sem IA,
 * sem grade_subjects, sem notas, sem conflitos, sem placeholders).
 */
import { describe, expect, it } from 'vitest';
import { parseGradePageLocal } from '../parseGradePageLocal';
import { decideSkipPageWithoutSubjects } from '../emptyPage';
import { TextToken } from '../types';
import {
  buildPageTokens, contextForPages, DEFAULT_COLUMNS, DEFAULT_SUBJECTS, PAGE_1, PageSpec,
} from './fixtures/siaep';

const HEADER = {
  name: 'ADRIANO SOUSA LIMA', code: '000123456', birth: '14/03/2009',
  mother: 'MARIA SOUSA LIMA', father: 'JOSE LIMA', classCode: '26RMM100',
};

const HEADER_B = {
  name: 'BRUNA MELO CARVALHO', code: '000456789', birth: '02/07/2008',
  mother: 'ANA MELO', father: 'PEDRO CARVALHO', classCode: '26RMM100',
};

const row = (subject: string, values: (string | null)[]) => ({
  subject,
  cells: values.map((v, i) => ({ nota: v, falta: String((i + 1) * 2) })),
});

/** Página 1 do aluno: primeira metade dos componentes. */
const PAGE_A1: PageSpec = {
  page: 1,
  header: HEADER,
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.slice(0, 5).map((s) => row(s, ['7,00', '8,00', '9,00', '0,00', '6,00'])),
};

/** Página 3 do MESMO aluno: continuação real das disciplinas. */
const PAGE_A3: PageSpec = {
  page: 3,
  header: HEADER,
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.slice(5).map((s) => row(s, ['5,00', '6,50', null, '10,00', '7,00'])),
};

/** Página de outro aluno (prova que páginas não são associadas ao aluno errado). */
const PAGE_B1: PageSpec = {
  page: 4,
  header: HEADER_B,
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.slice(0, 3).map((s) => row(s, ['4,00', '4,50', '5,00', '5,50', '4,75'])),
};

/** Página 2: cabeçalho/observação do mesmo aluno, ZERO disciplinas. */
function buildContinuationTokens(page: number, withGrid: boolean): TextToken[] {
  const token = (text: string, x: number, y: number, w = text.length * 5): TextToken =>
    ({ text, x, y, w, h: 9 });
  const tokens: TextToken[] = [
    token('SECRETARIA DE ESTADO DA EDUCACAO', 40, 800, 220),
    token('BOLETIM ESCOLAR', 40, 785, 110),
    token(`Aluno(a): ${HEADER.name}`, 40, 760, 260),
    token(`Código: ${HEADER.code}`, 40, 745, 120),
    token(`Data de Nascimento: ${HEADER.birth}`, 200, 745, 200),
    token(`Mãe: ${HEADER.mother}`, 40, 730, 240),
    token(`Pai: ${HEADER.father}`, 40, 715, 240),
    token(`Turma: ${HEADER.classCode}`, 400, 715, 150),
    token('Observações do Conselho de Classe: continuação da folha anterior.', 40, 600, 400),
    token('Este documento continua na próxima página.', 40, 580, 300),
    token('Assinatura do Diretor', 40, 90, 140),
  ];
  if (withGrid) {
    tokens.push(token('Disciplina', 40, 680, 60));
    DEFAULT_COLUMNS.forEach((c) => tokens.push(token(c.label, c.x, 680, c.width)));
    DEFAULT_COLUMNS.forEach((c) => {
      tokens.push(token('Nota', c.x + 5, 665, 25));
      if (c.hasAbsence !== false) tokens.push(token('Faltas', c.x + 40, 665, 30));
    });
  }
  return tokens.map((t) => ({ ...t, y: t.y - (page - 1) * 0 }));
}

const ctx = contextForPages([PAGE_A1, PAGE_B1]);

const run = (tokens: TextToken[], page: number) => parseGradePageLocal(tokens, {
  page,
  totalPages: 4,
  students: ctx.students,
  expectedSubjects: ctx.expectedSubjects,
});

const runSpec = (spec: PageSpec) => run(buildPageTokens(spec), spec.page);

describe('mesmo aluno em várias páginas do boletim', () => {
  it('duas páginas válidas do mesmo aluno preservam as linhas das duas', () => {
    const p1 = runSpec(PAGE_A1);
    const p3 = runSpec(PAGE_A3);
    expect(p1.skipPage.skip).toBe(false);
    expect(p3.skipPage.skip).toBe(false);
    const id1 = p1.preview!.detected.student_id;
    const id3 = p3.preview!.detected.student_id;
    expect(id1).toBeTruthy();
    expect(id3).toBe(id1);

    const subjects1 = new Set(p1.preview!.subjects.map((s) => s.name));
    const subjects3 = new Set(p3.preview!.subjects.map((s) => s.name));
    expect([...subjects1, ...subjects3].sort()).toEqual([...DEFAULT_SUBJECTS].sort());
    // Nenhuma disciplina é perdida ou sobreposta entre as páginas.
    expect([...subjects1].some((s) => subjects3.has(s))).toBe(false);

    // Toda linha válida mantém a página de origem para diagnóstico.
    expect(p1.preview!.rows.every((r) => r.source_page === 1)).toBe(true);
    expect(p3.preview!.rows.every((r) => r.source_page === 3)).toBe(true);

    const aggregated = [...p1.preview!.rows, ...p3.preview!.rows];
    expect(aggregated.every((r) => r.student_id === id1)).toBe(true);
    // Vazio continua vazio (null nunca vira 0,00).
    const empty = p3.preview!.rows.filter((r) => r.period === '3º Período');
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((r) => r.value === null)).toBe(true);
  });

  it('página intermediária sem disciplinas é ignorada e as válidas são agregadas ao mesmo aluno', () => {
    const p1 = runSpec(PAGE_A1);
    const p2 = run(buildContinuationTokens(2, true), 2);
    const p3 = runSpec(PAGE_A3);

    expect(p2.subjectCount).toBe(0);
    expect(p2.skipPage.skip).toBe(true);
    expect(p2.skipPage.note).toBe('Página 2 ignorada: nenhuma disciplina encontrada');

    const pages = [p1, p2, p3].filter((p) => !p.skipPage.skip);
    expect(pages).toHaveLength(2);
    const ids = new Set(pages.map((p) => p.preview!.detected.student_id));
    expect(ids.size).toBe(1);
    const rows = pages.flatMap((p) => p.preview!.rows);
    expect(new Set(rows.map((r) => r.source_page))).toEqual(new Set([1, 3]));
  });

  it('página sem grade nenhuma (só cabeçalho/observação) também é ignorada', () => {
    const p = run(buildContinuationTokens(2, false), 2);
    expect(p.subjectCount).toBe(0);
    expect(p.skipPage.skip).toBe(true);
  });

  it('página sem disciplinas não produz disciplina, nota, conflito nem prévia para gravar', () => {
    const p = run(buildContinuationTokens(2, true), 2);
    expect(p.preview?.subjects ?? []).toHaveLength(0);
    expect(p.preview?.rows ?? []).toHaveLength(0);
    expect(p.preview?.stats.cells_total ?? 0).toBe(0);
    expect(p.preview?.stats.grades_read ?? 0).toBe(0);
    expect(p.preview?.detected.conflicts ?? []).toHaveLength(0);
    // Nunca autoritativa nem "ok": a página não é enviada à IA porque é ignorada antes.
    expect(p.authoritative).toBe(false);
    expect(p.preview?.reading.ai_used ?? false).toBe(false);
  });

  it('importação de página única permanece idêntica (não é ignorada)', () => {
    const p = runSpec(PAGE_1);
    expect(p.skipPage.skip).toBe(false);
    expect(p.subjectCount).toBe(DEFAULT_SUBJECTS.length);
    expect(p.preview!.rows.length).toBeGreaterThan(0);
  });

  it('multi-aluno: cada página válida fica com o aluno correto', () => {
    const a = runSpec(PAGE_A1);
    const b = runSpec(PAGE_B1);
    const idA = a.preview!.detected.student_id;
    const idB = b.preview!.detected.student_id;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
    expect(a.preview!.student.pdf_name).toBe(HEADER.name);
    expect(b.preview!.student.pdf_name).toBe(HEADER_B.name);
    expect(a.preview!.rows.every((r) => r.student_id === idA)).toBe(true);
    expect(b.preview!.rows.every((r) => r.student_id === idB)).toBe(true);
  });
});

describe('decideSkipPageWithoutSubjects', () => {
  const tokens = [{ text: 'Aluno(a): X', x: 0, y: 0, w: 10, h: 9 }];
  it('não ignora página com disciplina reconhecida, mesmo com períodos vazios', () => {
    expect(decideSkipPageWithoutSubjects({ page: 5, tokens, subjectCount: 1, gridDetected: true }).skip).toBe(false);
  });
  it('não ignora página sem texto extraível (possível PDF digitalizado)', () => {
    expect(decideSkipPageWithoutSubjects({ page: 5, tokens: [], subjectCount: 0, gridDetected: false }).skip).toBe(false);
  });
  it('não ignora página com valores de nota fora das linhas de disciplina', () => {
    expect(decideSkipPageWithoutSubjects({
      page: 5, tokens, subjectCount: 0, gridDetected: true, orphanGradeTokens: 2,
    }).skip).toBe(false);
  });
  it('ignora página com texto, sem disciplina e sem valores de nota', () => {
    const d = decideSkipPageWithoutSubjects({ page: 7, tokens, subjectCount: 0, gridDetected: true });
    expect(d.skip).toBe(true);
    expect(d.note).toContain('Página 7 ignorada');
  });
});
