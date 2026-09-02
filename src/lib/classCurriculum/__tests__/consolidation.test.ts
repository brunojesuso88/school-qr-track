/**
 * Regressão do erro de sincronização do 3º ano (Aprofundamento IF com trilha CHL/CNS/ETT):
 * duplicatas equivalentes precisam ser CONSOLIDADAS, nunca tratadas como “fora da matriz”,
 * e nenhuma renomeação pode colidir com UNIQUE(class_id, normalized_name).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { planClassCurriculumSync, isPlanInSync, ExistingGradeSubject } from '../plan';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';
import { normalizeText } from '@/lib/gradePageLocal/normalize';

const item = (name: string, weekly: number): CurriculumMatrixItem => ({
  id: `m-${name}`, subject_id: `s-${name}`, series: '3', weekly_classes: weekly,
  include_in_ira: true, name, abbreviation: null, aliases: [],
});

const matrix3 = [item('APROFUNDAMENTO IF - I', 2), item('APROFUNDAMENTO IF - II', 2)];

const gs = (id: string, name: string, extra: Partial<ExistingGradeSubject> = {}): ExistingGradeSubject => ({
  id, name, weekly_classes: 2, include_in_ira: true, legacy_excluded: false, sort_order: null, ...extra,
});

describe('duplicatas equivalentes de Aprofundamento IF', () => {
  it('identifica alias + canônico como duplicata equivalente (não gradeLegacy)', () => {
    const plan = planClassCurriculumSync({
      matrix: matrix3,
      manageMapping: false,
      gradeSubjects: [
        gs('chl-1', 'APROFUNDAMENTO IF - CHL - I', { hasGrades: true, sort_order: 0 }),
        gs('can-1', 'APROFUNDAMENTO IF - I', { hasGrades: true, sort_order: 0 }),
        gs('chl-2', 'APROFUNDAMENTO IF - CHL - II', { hasGrades: true, sort_order: 1 }),
        gs('can-2', 'APROFUNDAMENTO IF - II', { hasGrades: true, sort_order: 1 }),
      ],
    });
    expect(plan.gradeLegacy).toHaveLength(0);
    expect(plan.gradeEquivalentDuplicates).toHaveLength(2);
    expect(plan.counts.consolidated).toBe(2);
  });

  it('o registro canônico exato é SEMPRE o destino, mesmo quando o alias tem notas', () => {
    const plan = planClassCurriculumSync({
      matrix: [item('APROFUNDAMENTO IF - I', 2)],
      manageMapping: false,
      gradeSubjects: [
        gs('alias', 'APROFUNDAMENTO IF - CHL - I', { hasGrades: true }),
        gs('canon', 'APROFUNDAMENTO IF - I', { hasGrades: false }),
      ],
    });
    const group = plan.gradeEquivalentDuplicates[0];
    expect(group.targetId).toBe('canon');
    expect(group.duplicates.map((d) => d.id)).toEqual(['alias']);
  });

  it('nenhum gradeUpdate tenta gravar normalized_name já usado por outro registro ativo', () => {
    const rows = [
      gs('alias', 'APROFUNDAMENTO IF - CHL - I', { hasGrades: true }),
      gs('canon', 'APROFUNDAMENTO IF - I', { hasGrades: true }),
    ];
    const plan = planClassCurriculumSync({ matrix: [item('APROFUNDAMENTO IF - I', 2)], manageMapping: false, gradeSubjects: rows });
    for (const upd of plan.gradeUpdate) {
      const collides = rows.some((r) => r.id !== upd.id && normalizeText(r.name) === upd.normalized_name);
      expect(collides).toBe(false);
    }
  });

  it('sem canônico exato, o alias com notas é promovido e renomeado', () => {
    const plan = planClassCurriculumSync({
      matrix: [item('APROFUNDAMENTO IF - I', 2)],
      manageMapping: false,
      gradeSubjects: [gs('alias', 'APROFUNDAMENTO IF - ETT - I', { hasGrades: true, sort_order: 0 })],
    });
    expect(plan.gradeEquivalentDuplicates).toHaveLength(0);
    expect(plan.gradeUpdate[0]).toMatchObject({ id: 'alias', name: 'APROFUNDAMENTO IF - I' });
  });

  it('após consolidação (source arquivado) o plano fica em sync — idempotente', () => {
    const after = [
      gs('alias', 'APROFUNDAMENTO IF - CHL - I', { legacy_excluded: true, include_in_ira: false, hasGrades: true }),
      gs('canon', 'APROFUNDAMENTO IF - I', { hasGrades: true, sort_order: 0 }),
      gs('alias2', 'APROFUNDAMENTO IF - CHL - II', { legacy_excluded: true, include_in_ira: false, hasGrades: true }),
      gs('canon2', 'APROFUNDAMENTO IF - II', { hasGrades: true, sort_order: 1 }),
    ];
    const plan = planClassCurriculumSync({ matrix: matrix3, manageMapping: false, gradeSubjects: after });
    expect(isPlanInSync(plan)).toBe(true);
  });

  it('componente realmente fora da matriz continua em gradeLegacy', () => {
    const plan = planClassCurriculumSync({
      matrix: matrix3,
      manageMapping: false,
      gradeSubjects: [
        gs('canon', 'APROFUNDAMENTO IF - I', { sort_order: 0 }),
        gs('canon2', 'APROFUNDAMENTO IF - II', { sort_order: 1 }),
        gs('velha', 'ELETIVA ANTIGA', { hasGrades: true }),
      ],
    });
    expect(plan.gradeEquivalentDuplicates).toHaveLength(0);
    expect(plan.gradeLegacy.map((g) => g.id)).toEqual(['velha']);
  });
});

describe('fetchSubjectIdsWithGrades', () => {
  beforeEach(() => vi.resetModules());

  const loadModule = async (impl: {
    rpc?: () => Promise<{ data: unknown; error: unknown }>;
    ranges?: string[][];
  }) => {
    const calls: [number, number][] = [];
    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: {
        rpc: impl.rpc ?? (async () => ({ data: null, error: { message: 'no rpc' } })),
        from: () => ({
          select: () => ({
            eq: () => ({
              in: () => ({
                range: async (from: number, to: number) => {
                  calls.push([from, to]);
                  const page = impl.ranges?.shift() ?? [];
                  return { data: page.map((id) => ({ grade_subject_id: id })), error: null };
                },
              }),
            }),
          }),
        }),

      },
    }));
    const mod = await import('../sync');
    return { fetchSubjectIdsWithGrades: mod.fetchSubjectIdsWithGrades, calls };
  };

  it('usa a RPC quando disponível (DISTINCT no banco, sem truncamento)', async () => {
    const { fetchSubjectIdsWithGrades } = await loadModule({
      rpc: async () => ({ data: ['a', 'b'], error: null }),
    });
    const set = await fetchSubjectIdsWithGrades(['a', 'b', 'c'], 'school-1');
    expect([...set].sort()).toEqual(['a', 'b']);
  });

  it('fallback pagina até esgotar: >1000 notas não escondem histórico', async () => {
    const page1 = Array.from({ length: 1000 }, () => 'a');
    const page2 = Array.from({ length: 1000 }, () => 'a');
    const page3 = ['b'];
    const { fetchSubjectIdsWithGrades, calls } = await loadModule({ ranges: [page1, page2, page3] });
    const set = await fetchSubjectIdsWithGrades(['a', 'b'], 'school-1');
    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});
