import { describe, expect, it } from 'vitest';
import { PageFailureQueue, classifyPageFailure, formatPageFailures } from '../failureQueue';

describe('classifyPageFailure', () => {
  it('classifica limite de uso, créditos, tempo e rede', () => {
    expect(classifyPageFailure(new Error('Rate limit exceeded')).reason).toBe('ai_rate_limited');
    expect(classifyPageFailure({ status: 429 }).reason).toBe('ai_rate_limited');
    expect(classifyPageFailure({ status: 402 }).reason).toBe('ai_payment_required');
    expect(classifyPageFailure(new Error('request timed out')).reason).toBe('ai_timeout');
    expect(classifyPageFailure(new TypeError('Failed to fetch')).reason).toBe('ai_network');
    expect(classifyPageFailure(new Error('invalid JSON')).reason).toBe('ai_invalid_response');
    expect(classifyPageFailure(new Error('boom')).reason).toBe('ai_error');
    expect(classifyPageFailure(null).reason).toBe('unknown');
  });

  it('preserva a mensagem real do erro', () => {
    expect(classifyPageFailure(new Error('429 Too Many Requests')).message).toBe('429 Too Many Requests');
  });
});

describe('PageFailureQueue', () => {
  it('acumula falhas sem abortar e lista em ordem de página', () => {
    const queue = new PageFailureQueue();
    queue.record({ page: 5, error: new Error('Failed to fetch') });
    queue.record({ page: 2, error: { status: 429 } });
    expect(queue.size).toBe(2);
    expect(queue.pendingPages()).toEqual([2, 5]);
    expect(queue.list().map((f) => f.reason)).toEqual(['ai_rate_limited', 'ai_network']);
  });

  it('guarda a prévia local para reaproveitar no reprocessamento', () => {
    const queue = new PageFailureQueue();
    const preview = { page: 3, subjects: [{ name: 'Arte' }] };
    queue.record({ page: 3, error: new Error('timeout'), localPreview: preview });
    queue.record({ page: 3, error: new Error('timeout') });
    expect(queue.get(3)?.localPreview).toBe(preview);
    expect(queue.get(3)?.attempts).toBe(2);
  });

  it('página confirmada ou ignorada nunca fica pendente', () => {
    const queue = new PageFailureQueue();
    queue.record({ page: 1, error: new Error('timeout') });
    queue.record({ page: 2, error: new Error('timeout') });
    queue.record({ page: 3, error: new Error('timeout') });
    queue.resolve(1);
    expect(queue.pendingPages({ confirmed: [2] })).toEqual([3]);
    expect(queue.pendingPages({ ignored: [3] })).toEqual([2]);
    expect(queue.has(1)).toBe(false);
  });

  it('resolver depois de reincidir mantém a página fora da fila', () => {
    const queue = new PageFailureQueue();
    queue.record({ page: 4, error: new Error('timeout') });
    queue.resolve(4);
    expect(queue.pendingPages()).toEqual([]);
    queue.record({ page: 4, error: new Error('timeout') });
    expect(queue.pendingPages()).toEqual([4]);
  });

  it('resume as pendências em linguagem simples', () => {
    const queue = new PageFailureQueue();
    expect(formatPageFailures(queue.list())).toContain('Nenhuma página');
    queue.record({ page: 7, error: { status: 402 } });
    expect(formatPageFailures(queue.list())).toBe(
      '1 página(s) para reprocessar: página 7 (créditos de IA esgotados)',
    );
  });
});
