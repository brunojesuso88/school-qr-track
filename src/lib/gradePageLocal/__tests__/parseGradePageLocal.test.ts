import { describe, expect, it } from 'vitest';
import { parseGradePageLocal } from '../parseGradePageLocal';
import { isEmptyMarker, normalizeText } from '../normalize';
import {
  buildFullBooklet, buildPageTokens, contextForPages, DEFAULT_SUBJECTS,
  PAGE_1, PAGE_18, PAGE_24, PAGE_41, PAGE_42, PAGE_45, PageSpec, REGRESSION_PAGES,
} from './fixtures/siaep';

const ctx = contextForPages(buildFullBooklet());

const run = (spec: PageSpec) => parseGradePageLocal(buildPageTokens(spec), {
  page: spec.page,
  totalPages: 45,
  students: ctx.students,
  expectedSubjects: ctx.expectedSubjects,
});

const cell = (result: ReturnType<typeof run>, subject: string, period: string) =>
  (result.preview?.rows ?? []).find(
    (r) => normalizeText(String(r.subject)) === normalizeText(subject) && normalizeText(String(r.period)) === normalizeText(period),
  );

describe('parseGradePageLocal — páginas de regressão do boletim real', () => {
  it.each(REGRESSION_PAGES.map((p) => [p.page, p] as const))('página %i é lida localmente', (_page, spec) => {
    const result = run(spec);
    expect(result.ok).toBe(true);
    expect(result.preview).not.toBeNull();
    // identificação do aluno
    expect(result.preview!.student.pdf_name).toBe(spec.header.name);
    expect(result.preview!.student.pdf_code).toBe(spec.header.code);
    expect(result.preview!.pdf_class_code).toBe(spec.header.classCode);
    expect(result.preview!.detected.status).toBe('matched');
    // períodos: exatamente 1º→4º, nunca Faltas nem colunas finais
    expect(result.preview!.periods.map((p) => p.label)).toEqual([
      '1º Período', '2º Período', '3º Período', '4º Período',
    ]);
    expect(result.preview!.periods.every((p) => p.kind === 'period')).toBe(true);
    expect(result.preview!.rows.some((r) => /media final|rec final|cons class|pendencia|^final$/i.test(normalizeText(String(r.period))))).toBe(false);
    expect(result.preview!.periods.some((p) => /falta/i.test(p.label))).toBe(false);
    // disciplinas completas
    expect(result.preview!.subjects).toHaveLength(DEFAULT_SUBJECTS.length);
    // nenhuma nota fora da escala
    expect(result.preview!.rows.every((r) => r.value == null || ((r.value as number) >= 0 && (r.value as number) <= 10))).toBe(true);
  });

  it('página 1: zero explícito é zero real e valores batem célula a célula', () => {
    const result = run(PAGE_1);
    expect(cell(result, 'BIOLOGIA', '1º Período')?.value).toBe(0);
    expect(cell(result, 'BIOLOGIA', '1º Período')?.flags).toContain('explicit_zero');
    expect(cell(result, 'ARTE', '1º Período')?.raw_value).toBe('3,17');
    expect(cell(result, 'QUIMICA', '2º Período')?.value).toBe(0);
    expect(cell(result, 'EDUCACAO FISICA', '4º Período')?.value).toBe(10);
    expect(result.preview!.stats.explicit_zero_cells).toBe(2);
    expect(result.confident).toBe(true);
  });

  it('página 18: células vazias permanecem null e não viram zero', () => {
    const result = run(PAGE_18);
    expect(cell(result, 'ARTE', '2º Período')?.value).toBeNull();
    expect(cell(result, 'ARTE', '2º Período')?.raw_value).toBeNull();
    expect(cell(result, 'ARTE', '2º Período')?.flags).toContain('empty_cell');
    expect(cell(result, 'BIOLOGIA', '2º Período')?.value).toBeNull();
    expect(cell(result, 'FILOSOFIA', '1º Período')?.value).toBeNull();
    // zero real continua zero na mesma página
    expect(cell(result, 'MATEMATICA', '1º Período')?.value).toBe(0);
    expect(result.preview!.stats.empty_cells).toBeGreaterThan(20);
    expect(result.preview!.stats.invalid_values).toBe(0);
  });

  it('página 24: disciplina preenchida tardiamente é lida no período correto', () => {
    const result = run(PAGE_24);
    expect(cell(result, 'FILOSOFIA', '1º Período')?.value).toBeNull();
    expect(cell(result, 'FILOSOFIA', '2º Período')?.value).toBeNull();
    expect(cell(result, 'FILOSOFIA', '3º Período')?.value).toBe(8);
    expect(cell(result, 'FILOSOFIA', '4º Período')?.value).toBe(9);
    expect(cell(result, 'QUIMICA', '4º Período')?.value).toBe(7.5);
    expect(cell(result, 'QUIMICA', '3º Período')?.value).toBeNull();
  });

  it('página 41: coluna Faltas nunca entra na saída, mesmo com valores 0–10', () => {
    const result = run(PAGE_41);
    const values = result.preview!.rows.map((r) => r.raw_value);
    // faltas da fixture: 2, 4, 6, dígitos avulsos — nenhum valor inteiro sem decimal deve existir
    expect(values.every((v) => v == null || /,\d{2}$/.test(String(v)))).toBe(true);
    expect(cell(result, 'ARTE', '1º Período')?.raw_value).toBe('7,00');
    expect(cell(result, 'ARTE', '4º Período')?.raw_value).toBe('10,00');
    expect(result.preview!.reading.absence_tokens_dropped).toBeGreaterThan(0);
  });

  it('página 42: 0,00 em todas as células é gravável como zero real', () => {
    const result = run(PAGE_42);
    expect(result.preview!.rows.every((r) => r.value === 0)).toBe(true);
    expect(result.preview!.stats.explicit_zero_cells).toBe(result.preview!.rows.length);
    expect(result.preview!.stats.empty_cells).toBe(0);
  });

  it('página 45: cabeçalho e notas da última página', () => {
    const result = run(PAGE_45);
    expect(result.preview!.student.pdf_birth_date).toBe('2008-09-18');
    expect(result.preview!.student.pdf_mother_name).toBe('IRACEMA NUNES');
    expect(result.preview!.student.pdf_father_name).toBe('RAIMUNDO SANTOS');
    expect(cell(result, 'ARTE', '4º Período')?.value).toBe(0);
    expect(cell(result, 'ARTE', '2º Período')?.value).toBe(7.5);
  });

  it('página sem camada de texto é marcada como local inconclusivo', () => {
    const result = parseGradePageLocal([], { page: 3, totalPages: 45, students: ctx.students, expectedSubjects: ctx.expectedSubjects });
    expect(result.ok).toBe(false);
    expect(result.confident).toBe(false);
    expect(result.preview).toBeNull();
    expect(result.validation.reasons.length).toBeGreaterThan(0);
  });
});

describe('métricas do boletim de 45 páginas', () => {
  it('resolve localmente ao menos 80% das páginas, sem faltas e sem notas trocadas', () => {
    const booklet = buildFullBooklet();
    const context = contextForPages(booklet);
    let confident = 0;
    let totalMs = 0;
    for (const spec of booklet) {
      const tokens = buildPageTokens(spec);
      const started = performance.now();
      const result = parseGradePageLocal(tokens, {
        page: spec.page, totalPages: 45,
        students: context.students, expectedSubjects: context.expectedSubjects,
      });
      totalMs += performance.now() - started;
      if (result.confident) confident++;
      expect(result.ok).toBe(true);

      // zero falta importada + zero nota trocada entre disciplina/período
      for (const row of result.preview!.rows) {
        const specRow = spec.rows.find((r) => normalizeText(r.subject) === normalizeText(String(row.subject)));
        const columnIndex = spec.columns.findIndex((c) => normalizeText(c.label) === normalizeText(String(row.period)));
        expect(specRow).toBeDefined();
        expect(columnIndex).toBeGreaterThanOrEqual(0);
        const expectedNota = specRow!.cells[columnIndex]?.nota ?? null;
        const normalizedExpected = expectedNota && !isEmptyMarker(expectedNota) ? expectedNota : null;
        expect(row.raw_value ?? null).toBe(normalizedExpected);
      }
    }
    const ratio = confident / booklet.length;
    // eslint-disable-next-line no-console
    console.log(`páginas locais confiáveis: ${confident}/${booklet.length} (${(ratio * 100).toFixed(1)}%) · média ${(totalMs / booklet.length).toFixed(1)}ms/página`);
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(totalMs / booklet.length).toBeLessThan(500);
  });
});