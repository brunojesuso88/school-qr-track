import { describe, expect, it } from 'vitest';
import {
  canFinishSession,
  failureFlow,
  failuresFromRows,
  firstUnresolvedPage,
  isResolvedPageStatus,
  resolveAdvance,
} from '../sequentialFlow';
import { splitPeriodPayload } from '../targetCache';

describe('ordem estrita da importação', () => {
  it('falha na página N nunca avança para N+1', () => {
    expect(failureFlow(3)).toEqual({ action: 'hold', page: 3, advance: false });
  });

  it('não finaliza a sessão enquanto houver falha pendente', () => {
    expect(canFinishSession([])).toBe(true);
    expect(canFinishSession([2])).toBe(false);
  });

  it('última página resolvida com falha anterior volta para a falha, não finaliza', () => {
    expect(resolveAdvance({ currentPage: 5, totalPages: 5, pendingFailurePages: [2] }))
      .toEqual({ action: 'retry_pending', page: 2 });
    expect(resolveAdvance({ currentPage: 5, totalPages: 5, pendingFailurePages: [] }))
      .toEqual({ action: 'finish' });
  });

  it('página resolvida segue para a próxima quando nada anterior falhou', () => {
    expect(resolveAdvance({ currentPage: 2, totalPages: 5, pendingFailurePages: [] }))
      .toEqual({ action: 'next', page: 3 });
    expect(resolveAdvance({ currentPage: 2, totalPages: 5, pendingFailurePages: [2] }))
      .toEqual({ action: 'next', page: 3 });
    expect(resolveAdvance({ currentPage: 4, totalPages: 5, pendingFailurePages: [2] }))
      .toEqual({ action: 'retry_pending', page: 2 });
  });

  it('retomada volta para a primeira página não resolvida, inclusive erro', () => {
    const rows = [
      { page_number: 1, status: 'confirmed' },
      { page_number: 2, status: 'error', error: 'network timeout' },
      { page_number: 3, status: 'ignored' },
      { page_number: 4, status: 'pending' },
    ];
    expect(firstUnresolvedPage(rows)).toBe(2);
    expect(isResolvedPageStatus('confirmed')).toBe(true);
    expect(isResolvedPageStatus('error')).toBe(false);
    const failures = failuresFromRows(rows);
    expect(failures).toHaveLength(1);
    expect(failures[0].page).toBe(2);
    expect(failures[0].message).toBe('network timeout');
  });

  it('sessão totalmente resolvida não tem próxima página', () => {
    expect(firstUnresolvedPage([
      { page_number: 1, status: 'confirmed' },
      { page_number: 2, status: 'ignored' },
    ])).toBeNull();
  });
});

describe('reuso de períodos já conhecidos da turma', () => {
  it('só envia ao banco os períodos ausentes do cache', () => {
    const known = new Map([['1 bimestre', 'p1']]);
    const split = splitPeriodPayload(
      [
        { normalized_label: '1 bimestre', label: '1º Bimestre' },
        { normalized_label: '2 bimestre', label: '2º Bimestre' },
      ],
      known,
    );
    expect(split.missing.map((p) => p.normalized_label)).toEqual(['2 bimestre']);
    expect(split.reused).toEqual([{ normalized_label: '1 bimestre', id: 'p1' }]);
  });
});
