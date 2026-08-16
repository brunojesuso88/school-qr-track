import { describe, expect, it } from 'vitest';

// Stub mínimo de localStorage (o client do backend é importado indiretamente).
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const { buildIraRankingPdf, formatStudentCode, RANKING_LIMIT } = await import('@/lib/iraRanking');
type RankingEntry = import('@/lib/iraRanking').RankingEntry;

const entries: RankingEntry[] = Array.from({ length: 25 }, (_, i) => ({
  studentId: `s${i}`,
  code: `1.234.${String(i).padStart(3, '0')}-9`,
  birthDate: '2008-03-15',
  className: '3ª Série A',
  ira: 10 - i * 0.1,
}));

describe('exportação da classificação do IRA', () => {
  it('sanitiza o código para somente dígitos', () => {
    expect(formatStudentCode('1.234.567-8')).toBe('12345678');
    expect(formatStudentCode(' 12 34,5 ')).toBe('12345');
    expect(formatStudentCode(null)).toBe('');
  });

  it('exporta 15 registros em uma única página, sem texto proibido', async () => {
    expect(RANKING_LIMIT).toBe(15);
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['3ª Série A'], periodsLabel: '1º + 2º', totalEligible: entries.length,
    });
    expect(doc.getNumberOfPages()).toBe(1);

    const text = doc.output('datauristring');
    const raw = Buffer.from(text.split(',')[1], 'base64').toString('latin1');
    expect(raw).not.toContain('Documento de divulga');
    expect(raw).not.toContain('gina 1');

    const rows = entries.slice(0, RANKING_LIMIT);
    expect(rows).toHaveLength(15);
    rows.forEach((e) => expect(formatStudentCode(e.code)).toMatch(/^[0-9]+$/));
  });
});
