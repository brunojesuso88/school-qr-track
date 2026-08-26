import { describe, expect, it } from 'vitest';
import { planClassCurriculumSync, isPlanInSync } from '../plan';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';

const item = (name: string, weekly: number, aliases: string[] = []): CurriculumMatrixItem => ({
  id: `m-${name}`, subject_id: `s-${name}`, series: '2', weekly_classes: weekly,
  include_in_ira: true, name, abbreviation: null, aliases,
});

const matrix = [item('LINGUA PORTUGUESA', 4), item('MATEMATICA', 4), item('APROFUNDAMENTO IF - I', 2)];

describe('planClassCurriculumSync', () => {
  it('cria as disciplinas da matriz que faltam na turma', () => {
    const plan = planClassCurriculumSync({ matrix });
    expect(plan.gradeCreate.map((g) => g.name).sort()).toEqual(
      ['APROFUNDAMENTO IF - I', 'LINGUA PORTUGUESA', 'MATEMATICA'],
    );
    expect(plan.counts.created).toBe(3);
  });

  it('reaproveita disciplina equivalente (Aprofundamento com trilha) sem duplicar', () => {
    const plan = planClassCurriculumSync({
      matrix,
      gradeSubjects: [
        { id: 'a', name: 'APROFUNDAMENTO IF - CHL - I', weekly_classes: null, include_in_ira: true, hasGrades: true },
      ],
    });
    expect(plan.gradeCreate.map((g) => g.name)).not.toContain('APROFUNDAMENTO IF - I');
    expect(plan.gradeUpdate.find((u) => u.id === 'a')?.weekly_classes).toBe(2);
    expect(plan.gradeLegacy).toHaveLength(0);
  });

  it('canônico exato é o destino e o alias vira duplicata equivalente a consolidar', () => {
    const plan = planClassCurriculumSync({
      matrix,
      gradeSubjects: [
        { id: 'sem', name: 'APROFUNDAMENTO IF - I', weekly_classes: 2, include_in_ira: true, hasGrades: false },
        { id: 'com', name: 'APROFUNDAMENTO IF - CHL - I', weekly_classes: null, include_in_ira: true, hasGrades: true },
      ],
    });
    expect(plan.gradeEquivalentDuplicates).toEqual([
      {
        canonicalName: 'APROFUNDAMENTO IF - I',
        targetId: 'sem',
        targetName: 'APROFUNDAMENTO IF - I',
        duplicates: [{ id: 'com', name: 'APROFUNDAMENTO IF - CHL - I', hasGrades: true }],
      },
    ]);
    expect(plan.gradeLegacy).toHaveLength(0);
  });


  it('marca disciplinas fora da matriz da série como legadas, preservando histórico', () => {
    const plan = planClassCurriculumSync({
      matrix,
      gradeSubjects: [{ id: 'x', name: 'ELETIVA ANTIGA', weekly_classes: 1, include_in_ira: true, hasGrades: true }],
    });
    expect(plan.gradeLegacy).toEqual([{ id: 'x', name: 'ELETIVA ANTIGA', hasGrades: true }]);
    expect(plan.counts.excludedLegacy).toBe(1);
  });

  it('é idempotente: turma já sincronizada não gera escritas', () => {
    const synced = matrix.map((m, i) => ({
      id: `g${i}`, name: m.name, weekly_classes: m.weekly_classes,
      include_in_ira: true, legacy_excluded: false, sort_order: i,
    }));
    const ordered = [...matrix].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const rows = ordered.map((m, i) => ({
      id: `g-${m.name}`, name: m.name, weekly_classes: m.weekly_classes,
      include_in_ira: true, legacy_excluded: false, sort_order: i,
    }));
    expect(synced.length).toBe(3);
    const mappingRows = ordered.map((m) => ({ id: `m-${m.name}`, subject_name: m.name, weekly_classes: m.weekly_classes }));
    const plan = planClassCurriculumSync({ matrix, mappingSubjects: mappingRows, gradeSubjects: rows });
    expect(isPlanInSync(plan)).toBe(true);
  });

  it('corrige carga semanal divergente no mapeamento e nas notas', () => {
    const plan = planClassCurriculumSync({
      matrix: [item('EDUCACAO FISICA', 1)],
      mappingSubjects: [{ id: 'm1', subject_name: 'EDUCACAO FISICA', weekly_classes: 2 }],
      gradeSubjects: [{ id: 'g1', name: 'EDUCACAO FISICA', weekly_classes: 2, include_in_ira: true, sort_order: 0 }],
    });
    expect(plan.mappingUpdate).toEqual([{ id: 'm1', weekly_classes: 1 }]);
    expect(plan.gradeUpdate[0].weekly_classes).toBe(1);
  });
});

describe('turma sem camada mapping (manageMapping=false)', () => {
  const matrix = [item('MATEMATICA', 4), item('EDUCACAO FISICA', 1)];

  it('não planeja ações de mapeamento e fica em sync com grade_subjects alinhados', () => {
    const first = planClassCurriculumSync({ matrix, mappingSubjects: [], gradeSubjects: [], manageMapping: false });
    expect(first.mappingCreate).toHaveLength(0);
    expect(first.mappingUpdate).toHaveLength(0);
    expect(first.gradeCreate).toHaveLength(2);
    expect(isPlanInSync(first)).toBe(false);

    // Estado após aplicar apenas grade_subjects (mapping ausente).
    const gradeSubjects = first.gradeCreate.map((g, i) => ({
      id: `g${i}`,
      name: g.name,
      weekly_classes: g.weekly_classes,
      include_in_ira: true,
      legacy_excluded: false,
      sort_order: g.sort_order,
    }));

    const second = planClassCurriculumSync({ matrix, mappingSubjects: [], gradeSubjects, manageMapping: false });
    expect(second.gradeCreate).toHaveLength(0);
    expect(second.gradeUpdate).toHaveLength(0);
    expect(second.gradeLegacy).toHaveLength(0);
    expect(second.mappingCreate).toHaveLength(0);
    expect(isPlanInSync(second)).toBe(true);
  });

  it('sort_order segue a ordem alfabética oficial da matriz', () => {
    const plan = planClassCurriculumSync({ matrix, manageMapping: false });
    expect(plan.gradeCreate.map((g) => [g.name, g.sort_order])).toEqual([
      ['EDUCACAO FISICA', 0],
      ['MATEMATICA', 1],
    ]);
  });
});
