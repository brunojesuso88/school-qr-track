/**
 * Matriz curricular oficial por série + normalização dos Aprofundamentos
 * + herança segura da matriz para a turma.
 */
import { describe, expect, it } from 'vitest';
import { OFFICIAL_CURRICULUM_MATRIX, officialMatrixForSeries } from '../curriculumMatrixData';
import {
  CurriculumMatrixItem, findMatrixWeeklyDivergences, matrixToExpectedSubjects,
  matrixWeeklyTotal, selectMissingMatrixSubjects,
} from '../curriculumMatrixCore';
import { canonicalSubjectKey, normalizeText } from '../gradePageLocal/normalize';
import { buildSubjectAnchors, matchSubjectAnchor } from '../gradePageLocal/subjectAnchors';
import { buildEffectiveSubjectMatrix } from '../gradePageLocal/effectiveMatrix';
import { HighSchoolSeries } from '../series';

const S1 = officialMatrixForSeries('1');
const S2 = officialMatrixForSeries('2');
const S3 = officialMatrixForSeries('3');

const weeklyOf = (series: HighSchoolSeries, name: string) =>
  officialMatrixForSeries(series).find((s) => s.name === name)?.weekly_classes ?? null;

const asItems = (series: HighSchoolSeries): CurriculumMatrixItem[] =>
  officialMatrixForSeries(series).map((s, i) => ({
    id: `m${i}`, subject_id: `s${i}`, series, weekly_classes: s.weekly_classes,
    include_in_ira: true, name: s.name, abbreviation: s.abbreviation, aliases: s.aliases,
  }));

describe('matriz curricular oficial', () => {
  it('cada série possui exatamente 16 componentes', () => {
    expect(S1).toHaveLength(16);
    expect(S2).toHaveLength(16);
    expect(S3).toHaveLength(16);
  });

  it('cargas da série 1 conferem com a matriz institucional', () => {
    expect(Object.fromEntries(S1.map((s) => [s.name, s.weekly_classes]))).toEqual({
      'ARTE': 2, 'BIOLOGIA': 2, 'EDUCACAO DIGITAL': 1, 'EDUCACAO FISICA': 1, 'FILOSOFIA': 1,
      'FISICA': 2, 'GEOGRAFIA': 2, 'HISTORIA': 2, 'IDENTIDADE E PROTAGONISMO': 1,
      'LETRAMENTO EM LINGUA PORTUGUESA': 1, 'LETRAMENTO EM MATEMATICA': 1, 'LINGUA INGLESA': 1,
      'LINGUA PORTUGUESA': 4, 'MATEMATICA': 4, 'QUIMICA': 2, 'SOCIOLOGIA': 1,
    });
  });

  it('cargas da série 2 conferem com a matriz institucional', () => {
    expect(Object.fromEntries(S2.map((s) => [s.name, s.weekly_classes]))).toEqual({
      'APROFUNDAMENTO IF - I': 2, 'APROFUNDAMENTO IF - II': 2, 'ARTE': 1, 'BIOLOGIA': 2,
      'EDUCACAO DIGITAL': 1, 'EDUCACAO FISICA': 1, 'FILOSOFIA': 2, 'FISICA': 2, 'GEOGRAFIA': 2,
      'HISTORIA': 2, 'IDENTIDADE E PROTAGONISMO': 1, 'LINGUA INGLESA': 1, 'LINGUA PORTUGUESA': 4,
      'MATEMATICA': 4, 'QUIMICA': 2, 'SOCIOLOGIA': 1,
    });
  });

  it('cargas da série 3 conferem com a matriz institucional', () => {
    expect(Object.fromEntries(S3.map((s) => [s.name, s.weekly_classes]))).toEqual({
      'APROFUNDAMENTO IF - I': 2, 'APROFUNDAMENTO IF - II': 2, 'ARTE': 1, 'BIOLOGIA': 2,
      'EDUCACAO DIGITAL': 1, 'EDUCACAO FISICA': 1, 'FILOSOFIA': 1, 'FISICA': 2, 'GEOGRAFIA': 2,
      'HISTORIA': 2, 'IDENTIDADE E PROTAGONISMO': 1, 'LINGUA INGLESA': 2, 'LINGUA PORTUGUESA': 4,
      'MATEMATICA': 4, 'QUIMICA': 2, 'SOCIOLOGIA': 1,
    });
  });

  it('Arte 2/1/1, Filosofia 1/2/1 e Língua Inglesa 1/1/2', () => {
    expect([weeklyOf('1', 'ARTE'), weeklyOf('2', 'ARTE'), weeklyOf('3', 'ARTE')]).toEqual([2, 1, 1]);
    expect([weeklyOf('1', 'FILOSOFIA'), weeklyOf('2', 'FILOSOFIA'), weeklyOf('3', 'FILOSOFIA')]).toEqual([1, 2, 1]);
    expect([weeklyOf('1', 'LINGUA INGLESA'), weeklyOf('2', 'LINGUA INGLESA'), weeklyOf('3', 'LINGUA INGLESA')]).toEqual([1, 1, 2]);
  });

  it('Aprofundamentos existem apenas no 2º e 3º ano', () => {
    ['APROFUNDAMENTO IF - I', 'APROFUNDAMENTO IF - II'].forEach((name) => {
      expect(weeklyOf('1', name)).toBeNull();
      expect(weeklyOf('2', name)).toBe(2);
      expect(weeklyOf('3', name)).toBe(2);
    });
  });

  it('todos os componentes oficiais participam do IRA', () => {
    [...S1, ...S2, ...S3].forEach((s) => expect(s.include_in_ira).toBe(true));
  });

  it('totais reais calculados por série', () => {
    expect(matrixWeeklyTotal(S1)).toBe(28);
    expect(matrixWeeklyTotal(S2)).toBe(30);
    expect(matrixWeeklyTotal(S3)).toBe(30);
  });

  it('catálogo canônico possui 18 disciplinas distintas', () => {
    const keys = new Set(OFFICIAL_CURRICULUM_MATRIX.map((s) => canonicalSubjectKey(s.name)));
    expect(keys.size).toBe(18);
  });
});

describe('normalização dos Aprofundamentos', () => {
  const CANON_I = canonicalSubjectKey('APROFUNDAMENTO IF - I');
  const CANON_II = canonicalSubjectKey('APROFUNDAMENTO IF - II');

  it('CHL/CNS/ETT são ignorados para resolver I e II', () => {
    ['CHL', 'CNS', 'ETT'].forEach((axis) => {
      expect(canonicalSubjectKey(`APROFUNDAMENTO IF - ${axis} - I`)).toBe(CANON_I);
      expect(canonicalSubjectKey(`APROFUNDAMENTO IF ${axis} I`)).toBe(CANON_I);
      expect(canonicalSubjectKey(`APROFUNDAMENTO IF - ${axis}-II`)).toBe(CANON_II);
      expect(canonicalSubjectKey(`aprofundamento if  ${axis}  ii`)).toBe(CANON_II);
    });
  });

  it('I e II continuam sendo disciplinas distintas', () => {
    expect(CANON_I).not.toBe(CANON_II);
  });

  it('não remove CHL/CNS/ETT de outros nomes de disciplina', () => {
    expect(canonicalSubjectKey('PROJETO CNS')).toBe(normalizeText('PROJETO CNS'));
    expect(canonicalSubjectKey('ELETIVA ETT II')).toBe(normalizeText('ELETIVA ETT II'));
    expect(canonicalSubjectKey('APROFUNDAMENTO IF - CNS')).toBe(normalizeText('APROFUNDAMENTO IF - CNS'));
  });

  it('âncora resolve variação do boletim para o canônico', () => {
    const anchors = buildSubjectAnchors(matrixToExpectedSubjects(asItems('2')));
    expect(matchSubjectAnchor('APROFUNDAMENTO IF - CNS - I', anchors)?.anchor.canonical)
      .toBe('APROFUNDAMENTO IF - I');
    expect(matchSubjectAnchor('APROFUNDAMENTO IF - ETT - II', anchors)?.anchor.canonical)
      .toBe('APROFUNDAMENTO IF - II');
  });
});

describe('herança da matriz para a turma', () => {
  it('série 1 aplica carga 2 em Arte e série 2 aplica carga 1', () => {
    expect(selectMissingMatrixSubjects(asItems('1'), []).find((m) => m.name === 'ARTE')?.weekly_classes).toBe(2);
    expect(selectMissingMatrixSubjects(asItems('2'), []).find((m) => m.name === 'ARTE')?.weekly_classes).toBe(1);
  });

  it('não duplica componente já existente por alias ou eixo do aprofundamento', () => {
    const missing = selectMissingMatrixSubjects(asItems('2'), [
      { subject_name: 'APROFUNDAMENTO IF - CNS - I' },
      { subject_name: 'Língua Portuguesa' },
    ]);
    expect(missing.map((m) => m.name)).not.toContain('APROFUNDAMENTO IF - I');
    expect(missing.map((m) => m.name)).not.toContain('LINGUA PORTUGUESA');
    expect(missing).toHaveLength(14);
  });

  it('preserva disciplina extra e carga customizada (apenas relata divergência)', () => {
    const existing = [
      { subject_name: 'ARTE', weekly_classes: 3 },
      { subject_name: 'ELETIVA DE ROBOTICA', weekly_classes: 2 },
    ];
    const missing = selectMissingMatrixSubjects(asItems('1'), existing);
    expect(missing.map((m) => m.name)).not.toContain('ARTE');
    expect(missing).toHaveLength(15);
    const div = findMatrixWeeklyDivergences(asItems('1'), existing);
    expect(div).toEqual([{ name: 'ARTE', current: 3, expected: 2 }]);
  });

  it('matriz efetiva prioriza a matriz oficial e preserva disciplinas da turma', () => {
    const effective = buildEffectiveSubjectMatrix({
      matrix: matrixToExpectedSubjects(asItems('2')),
      mapping: [{ name: 'ELETIVA DE ROBOTICA', weekly_classes: 2 }],
    });
    expect(effective).toHaveLength(17);
    const arte = effective.find((s) => s.name === 'ARTE');
    expect(arte?.weekly_classes).toBe(1);
    expect(arte?.origin).toEqual(['matrix']);
    expect(effective.find((s) => s.name === 'ELETIVA DE ROBOTICA')?.weekly_classes).toBe(2);
  });
});
