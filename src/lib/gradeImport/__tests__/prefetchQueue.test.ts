import { describe, expect, it, vi } from 'vitest';
import { LocalPrefetchQueue } from '../prefetchQueue';

const flush = async (times = 6) => { for (let i = 0; i < times; i += 1) await Promise.resolve(); };

describe('LocalPrefetchQueue', () => {
  it('lê as próximas páginas em segundo plano e reaproveita a leitura pronta', async () => {
    const read = vi.fn(async (page: number) => `p${page}`);
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 2, maxConcurrency: 2 });
    queue.setScope('sessao-1');
    queue.schedule(1, 10);
    await flush();
    expect(read.mock.calls.map((c) => c[0])).toEqual([2, 3]);
    const taken = await queue.take(2);
    expect(taken).toEqual({ value: 'p2', reused: true });
    expect(read).toHaveBeenCalledTimes(2);
    expect(queue.stats.reusedPages).toBe(1);
  });

  it('lê na hora quando a página não foi pré-lida', async () => {
    const read = vi.fn(async (page: number) => `p${page}`);
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 0 });
    queue.setScope('sessao-1');
    queue.schedule(1, 10);
    expect(read).not.toHaveBeenCalled();
    expect(await queue.take(2)).toEqual({ value: 'p2', reused: false });
  });

  it('respeita o limite de leituras simultâneas', async () => {
    let active = 0;
    let peak = 0;
    const release: Array<() => void> = [];
    const read = vi.fn((page: number) => {
      active += 1; peak = Math.max(peak, active);
      return new Promise<string>((resolve) => {
        release.push(() => { active -= 1; resolve(`p${page}`); });
      });
    });
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 4, maxConcurrency: 2 });
    queue.setScope('s');
    queue.schedule(1, 10);
    await flush();
    expect(peak).toBe(2);
    release.forEach((fn) => fn());
    await flush(10);
    expect(peak).toBe(2);
    expect(read.mock.calls.map((c) => c[0])).toEqual([2, 3, 4, 5]);
  });

  it('descarta a fila ao trocar de sessão e não devolve leitura de outro documento', async () => {
    const read = vi.fn(async (page: number) => `antigo-${page}`);
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 2 });
    queue.setScope('sessao-1');
    queue.schedule(1, 10);
    await flush();
    queue.setScope('sessao-2');
    expect(queue.has(2)).toBe(false);
    read.mockImplementation(async (page: number) => `novo-${page}`);
    expect(await queue.take(2)).toEqual({ value: 'novo-2', reused: false });
  });

  it('falha na pré-leitura não vira erro: relê a página na hora', async () => {
    let first = true;
    const read = vi.fn(async (page: number) => {
      if (first) { first = false; throw new Error('pdf ilegível'); }
      return `p${page}`;
    });
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 1 });
    queue.setScope('s');
    queue.schedule(1, 10);
    await flush();
    expect(await queue.take(2)).toEqual({ value: 'p2', reused: false });
    expect(queue.stats.reusedPages).toBe(0);
  });

  it('descarta páginas já passadas', async () => {
    const read = vi.fn(async (page: number) => `p${page}`);
    const queue = new LocalPrefetchQueue<string>({ read, lookahead: 3, maxConcurrency: 3 });
    queue.setScope('s');
    queue.schedule(1, 10);
    await flush();
    queue.prune(3);
    expect(queue.has(2)).toBe(false);
    expect(queue.has(3)).toBe(false);
    expect(queue.has(4)).toBe(true);
  });
});
