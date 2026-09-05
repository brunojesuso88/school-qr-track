import { describe, expect, it, vi } from 'vitest';
import { ImportTargetCache, subjectSlotKey, targetCacheKey, type ImportTargets } from '../targetCache';

const subject = (over: Partial<ImportTargets['subjects'][number]> = {}) => ({
  id: 'sub-1',
  name: 'Matemática',
  normalized_name: 'matematica',
  slot_index: 1,
  include_in_ira: true,
  custom_ira_weight: null,
  legacy_excluded: false,
  weekly_classes: 4,
  ...over,
});

const targets = (): ImportTargets => ({
  subjects: [subject(), subject({ id: 'sub-2', slot_index: 2, name: 'Matemática', weekly_classes: 2 })],
  periods: [{ id: 'per-1', normalized_label: '1 periodo' }],
});

describe('targetCache', () => {
  it('separa escopos por escola, turma e matriz', () => {
    const a = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    expect(a).not.toBe(targetCacheKey({ schoolId: 's2', classId: 'c1', matrixId: 'm1' }));
    expect(a).not.toBe(targetCacheKey({ schoolId: 's1', classId: 'c2', matrixId: 'm1' }));
    expect(a).not.toBe(targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm2' }));
    expect(targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: null })).toContain('no-matrix');
  });

  it('carrega uma única vez por sessão e reaproveita nas páginas seguintes', async () => {
    const loader = vi.fn(async () => targets());
    const cache = new ImportTargetCache();
    const key = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    expect((await cache.ensure(key, loader)).fromCache).toBe(false);
    expect((await cache.ensure(key, loader)).fromCache).toBe(true);
    expect((await cache.ensure(key, loader)).fromCache).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.stats).toMatchObject({ selects: 1, selectsSaved: 2, subjects: 2, periods: 1 });
  });

  it('recarrega quando a turma muda e não devolve dados do escopo anterior', async () => {
    const loader = vi.fn(async () => targets());
    const cache = new ImportTargetCache();
    const key1 = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    const key2 = targetCacheKey({ schoolId: 's1', classId: 'c2', matrixId: 'm1' });
    await cache.ensure(key1, loader);
    await cache.ensure(key2, loader);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(cache.subjectRows(key1)).toEqual([]);
    expect(cache.subjectId(key1, 'matematica', 1)).toBeUndefined();
    expect(cache.subjectId(key2, 'matematica', 1)).toBe('sub-1');
  });

  it('trata cada ocorrência (slot) da mesma disciplina como destino distinto', async () => {
    const cache = new ImportTargetCache();
    const key = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    await cache.ensure(key, async () => targets());
    expect(cache.subjectId(key, 'matematica', 1)).toBe('sub-1');
    expect(cache.subjectId(key, 'matematica', 2)).toBe('sub-2');
    expect(subjectSlotKey('matematica', null)).toBe('matematica#1');
    expect(cache.subjectId(key, 'matematica', null)).toBe('sub-1');
  });

  it('atualiza destinos gravados sem novo SELECT e preserva campos anteriores', async () => {
    const loader = vi.fn(async () => targets());
    const cache = new ImportTargetCache();
    const key = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    await cache.ensure(key, loader);
    cache.putSubject(key, subject({ id: 'sub-1', weekly_classes: 4, custom_ira_weight: 3 }));
    cache.putSubject(key, subject({ id: 'sub-9', normalized_name: 'arte', name: 'Arte', weekly_classes: 1 }));
    cache.putPeriod(key, { id: 'per-2', normalized_label: '2 periodo' });
    expect(cache.subjectId(key, 'arte', 1)).toBe('sub-9');
    expect(cache.periodIdMap(key).get('2 periodo')).toBe('per-2');
    expect(cache.subjectRows(key).find((s) => s.id === 'sub-1')?.custom_ira_weight).toBe(3);
    await cache.ensure(key, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('ignora escritas de escopo diferente do carregado', async () => {
    const cache = new ImportTargetCache();
    const key = targetCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    const other = targetCacheKey({ schoolId: 's2', classId: 'c1', matrixId: 'm1' });
    await cache.ensure(key, async () => targets());
    cache.putSubject(other, subject({ id: 'invasor', normalized_name: 'fisica' }));
    cache.putPeriod(other, { id: 'invasor', normalized_label: '3 periodo' });
    expect(cache.subjectId(key, 'fisica', 1)).toBeUndefined();
    expect(cache.periodIdMap(key).has('3 periodo')).toBe(false);
  });
});
