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

const {
  buildIraRankingPdf, formatStudentCode, RANKING_LIMIT, detectClassSeries, FOOTER_MESSAGE, seriesLabel,
} = await import('@/lib/iraRanking');
type RankingEntry = import('@/lib/iraRanking').RankingEntry;
type HighSchoolSeries = import('@/lib/iraRanking').HighSchoolSeries;

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
      classNames: ['3ª Série A'], periodsLabel: '1º + 2º', totalEligible: entries.length, series: '3',
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

  it('detecta a série da turma e ignora nomes ambíguos', () => {
    expect(detectClassSeries('1ª Série A')).toBe('1');
    expect(detectClassSeries('2º ANO B')).toBe('2');
    expect(detectClassSeries('3 ano C')).toBe('3');
    expect(detectClassSeries('Turma Especial')).toBeNull();
    expect(detectClassSeries('1ª e 2ª Série')).toBeNull();
  });

  it('filtra turmas pela série e limpa seleção incompatível', () => {
    const classes = [
      { id: 'a', name: '1ª Série A' },
      { id: 'b', name: '2ª Série B' },
      { id: 'c', name: '3º ANO C' },
      { id: 'd', name: 'Multisseriada' },
    ];
    const forSeries = (s: HighSchoolSeries) => classes.filter((c) => detectClassSeries(c.name) === s);
    expect(forSeries('1').map((c) => c.id)).toEqual(['a']);
    expect(forSeries('2').map((c) => c.id)).toEqual(['b']);

    // troca de série limpa seleção incompatível
    const selected = ['a', 'b'];
    const cleaned = selected.filter((id) =>
      detectClassSeries(classes.find((c) => c.id === id)!.name) === '2');
    expect(cleaned).toEqual(['b']);
  });

  it('exibe a série escolhida e apenas uma frase motivacional no rodapé', async () => {
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['2ª Série A'], periodsLabel: '1º', totalEligible: entries.length, series: '2',
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).toContain('RANKING DO IRA');
    expect(raw).toContain('SERIE DO ENSINO M') // acentos codificados; confere trecho ASCII
      ;
    expect(seriesLabel('2')).toBe('2ª Série do Ensino Médio');
    expect(FOOTER_MESSAGE).toBe('CONTINUE AVANÇANDO. O MELHOR AINDA ESTÁ POR VIR!');
    ['CADA PONTO TE APROXIMA DO TOPO', 'SUPERE SEUS LIMITES', 'MAIOR PODER'].forEach((t) =>
      expect(raw).not.toContain(t));
  });
});
