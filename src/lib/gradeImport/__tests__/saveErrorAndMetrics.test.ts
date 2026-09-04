import { describe, expect, it } from 'vitest';
import { describeSaveError, STALE_CLIENT_MESSAGE } from '../saveError';
import { contextCacheKey, ImportContextCache } from '../contextCache';
import { formatReadingMetrics, resolveWeeklyClassesForUpsert, summarizeReadingMetrics } from '../readingMetrics';

describe('describeSaveError — nunca engole o erro real do banco', () => {
  it('erro do banco como objeto simples (sem throwOnError) vira mensagem útil', () => {
    const d = describeSaveError({ message: 'duplicate key value', code: '23505', details: 'Key (x) exists', hint: null });
    expect(d.message).toBe('Erro ao gravar a página. duplicate key value — Key (x) exists');
    expect(d.code).toBe('23505');
    expect(d.staleClient).toBe(false);
  });

  it('42P10 (ON CONFLICT sem índice — cliente desatualizado) orienta a atualizar a página', () => {
    const d = describeSaveError({
      message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      code: '42P10',
    });
    expect(d.staleClient).toBe(true);
    expect(d.message).toContain(STALE_CLIENT_MESSAGE);
    expect(d.message).toContain('ON CONFLICT');
  });

  it('PGRST204 (coluna fora do cache de esquema) também é cliente desatualizado', () => {
    expect(describeSaveError({ message: "Could not find the 'slot_index' column", code: 'PGRST204' }).staleClient).toBe(true);
  });

  it('Error comum, falha de rede e permissão', () => {
    expect(describeSaveError(new Error('Selecione o aluno')).message).toBe('Selecione o aluno');
    const net = describeSaveError(new TypeError('Failed to fetch'));
    expect(net.offline).toBe(true);
    expect(net.message).toContain('Sem resposta do servidor');
    expect(describeSaveError({ message: 'permission denied for table student_grades', code: '42501' }).message)
      .toContain('Sem permissão');
    expect(describeSaveError(undefined).message).toBe('Erro ao gravar a página.');
  });
});

describe('ImportContextCache — cache em memória por school + class + matrix', () => {
  it('chave inclui escola, turma e matriz', () => {
    expect(contextCacheKey({ schoolId: 's', classId: 'c', matrixId: 'm' })).toBe('s::c::m');
    expect(contextCacheKey({ schoolId: 's', classId: 'c', matrixId: null })).toBe('s::c::no-matrix');
  });

  it('hit, miss, expiração e invalidação por prefixo', () => {
    let now = 1_000;
    const cache = new ImportContextCache<number>(500, () => now);
    const key = contextCacheKey({ schoolId: 's1', classId: 'c1', matrixId: 'm1' });
    expect(cache.get(key)).toBeNull();
    cache.set(key, 42);
    expect(cache.get(key)).toBe(42);
    now += 600;
    expect(cache.get(key)).toBeNull();
    cache.set(key, 1);
    cache.set(contextCacheKey({ schoolId: 's2', classId: 'c9', matrixId: 'm' }), 2);
    expect(cache.invalidate('s1::')).toBe(1);
    expect(cache.size).toBe(1);
    expect(cache.stats).toEqual({ hits: 1, misses: 2 });
  });
});

describe('métricas locais do resumo', () => {
  it('conta local/IA/ignoradas, % local e tempo médio', () => {
    const m = summarizeReadingMetrics({ localPages: 3, aiPages: 1, ignoredPages: 2, timingsMs: [100, 200, 300] });
    expect(m).toMatchObject({ readPages: 4, localPct: 75, avgLocalMs: 200 });
    expect(formatReadingMetrics(m)).toBe('Leitura local: 3 página(s) · IA: 1 página(s) · ignoradas: 2 · tempo médio local 200ms · 75% sem IA');
    expect(summarizeReadingMetrics({ localPages: 0, aiPages: 0, ignoredPages: 0, timingsMs: [] }))
      .toMatchObject({ localPct: 0, avgLocalMs: null });
  });
});

describe('resolveWeeklyClassesForUpsert — regravação nunca rebaixa carga informada', () => {
  it('prévia sem carga (IA) preserva a carga já gravada', () => {
    expect(resolveWeeklyClassesForUpsert(null, 2)).toBe(2);
    expect(resolveWeeklyClassesForUpsert(0, 4)).toBe(4);
  });
  it('carga informada na prévia prevalece; sem nenhuma, mantém 0/null', () => {
    expect(resolveWeeklyClassesForUpsert(3, 2)).toBe(3);
    expect(resolveWeeklyClassesForUpsert(0, null)).toBe(0);
    expect(resolveWeeklyClassesForUpsert(null, null)).toBeNull();
  });
});
