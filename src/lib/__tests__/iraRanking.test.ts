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
  parseClassSeries, classSeriesLabel, CLASS_SERIES_OPTIONS,
  DEFAULT_RANKING_PDF_COLUMNS, RANKING_PDF_COLUMN_OPTIONS, orderRankingColumns,
} = await import('@/lib/iraRanking');
type RankingEntry = import('@/lib/iraRanking').RankingEntry;
type HighSchoolSeries = import('@/lib/iraRanking').HighSchoolSeries;

const entries: RankingEntry[] = Array.from({ length: 25 }, (_, i) => ({
  studentId: `s${i}`,
  code: `1.234.${String(i).padStart(3, '0')}-9`,
  fullName: `Aluno Sobrenome Composto Numero ${i}`,
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
    // Metadados removidos: sem "Base:" e sem contagem de elegíveis
    expect(raw).not.toContain('Base:');
    expect(raw).not.toContain('eleg');
    expect(raw).toContain('Emitido em');
    expect(raw).toContain('Turmas/S');

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

  it('usa a série estruturada da turma no filtro do ranking', () => {
    const classes = [
      { id: 'a', name: 'Turma Alfa', series: '1' as string | null },
      { id: 'b', name: 'Turma Beta', series: '2' as string | null },
      { id: 'c', name: '3ª Série C', series: null as string | null },
      { id: 'd', name: 'Turma Delta', series: 'x' as string | null },
    ];
    const forSeries = (s: '1' | '2' | '3') =>
      classes.filter((c) => parseClassSeries(c.series) === s).map((c) => c.id);

    expect(forSeries('1')).toEqual(['a']);
    classes[0].series = '2';
    expect(forSeries('1')).toEqual([]);
    expect(forSeries('2')).toEqual(['a', 'b']);
    // turma sem série (ou valor inválido) fica fora, mesmo com nome sugestivo
    expect(forSeries('3')).toEqual([]);
    expect(parseClassSeries(null)).toBeNull();
    expect(parseClassSeries('x')).toBeNull();
    expect(classSeriesLabel(null)).toBe('Série não definida');
  });

  it('expõe exatamente as três opções de série do cadastro', () => {
    expect(CLASS_SERIES_OPTIONS.map((o) => o.label)).toEqual([
      '1º ano do Ensino Médio', '2º ano do Ensino Médio', '3º ano do Ensino Médio',
    ]);
    expect(classSeriesLabel('1')).toBe('1º ano do Ensino Médio');
  });

  it('exibe a série escolhida e apenas uma frase motivacional no rodapé', async () => {
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['2ª Série A'], periodsLabel: '1º', totalEligible: entries.length, series: '2',
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).toContain('RANKING DO IRA');
    expect(raw).toContain('RIE DO ENSINO M'); // "SÉRIE DO ENSINO MÉDIO" (acentos codificados)
    expect(seriesLabel('2')).toBe('2ª Série do Ensino Médio');
    expect(FOOTER_MESSAGE).toBe('Você não precisa ser melhor que ninguém para ser o melhor de si');
    ['CONTINUE AVAN', 'CADA PONTO TE APROXIMA DO TOPO', 'SUPERE SEUS LIMITES', 'MAIOR PODER'].forEach((t) =>
      expect(raw).not.toContain(t));
  });

  it('usa a faixa "TOP 15 — MELHORES IRAs"', async () => {
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['1ª Série A', '1ª Série B'], periodsLabel: '', totalEligible: entries.length, series: '1',
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).toContain('TOP 15');
    expect(raw).toContain('MELHORES IRAs');
  });

  it('mantém uma única página com turma longa "Sala Fora"', async () => {
    const longEntries = entries.map((e) => ({ ...e, className: '26RMM-CNS-300 Sala Fora' }));
    const doc = await buildIraRankingPdf(longEntries, {
      classNames: ['26RMM-CNS-300 Sala Fora'], periodsLabel: '', totalEligible: longEntries.length, series: '3',
    });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('não inclui Nome completo nas colunas padrão', () => {
    expect(DEFAULT_RANKING_PDF_COLUMNS).toEqual(['position', 'code', 'birthDate', 'className', 'ira']);
    expect(RANKING_PDF_COLUMN_OPTIONS).toHaveLength(6);
    expect(orderRankingColumns(['ira', 'position'])).toEqual(['position', 'ira']);
  });

  it('omite o nome completo do PDF quando a coluna não é selecionada', async () => {
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['3ª Série A'], periodsLabel: '', totalEligible: entries.length, series: '3',
    });
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).not.toContain('NOME COMPLETO');
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('inclui o nome completo e mantém uma página com todas as colunas e turma longa', async () => {
    const longEntries = entries.map((e) => ({ ...e, className: '26RMM-CNS-300 Sala Fora' }));
    const doc = await buildIraRankingPdf(longEntries, {
      classNames: ['26RMM-CNS-300 Sala Fora'], periodsLabel: '', totalEligible: longEntries.length, series: '3',
      columns: RANKING_PDF_COLUMN_OPTIONS.map((o) => o.value),
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).toContain('NOME COMPLETO');
  });

  it('não desenha a coluna de posição quando desmarcada', async () => {
    const doc = await buildIraRankingPdf(entries, {
      classNames: ['3ª Série A'], periodsLabel: '', totalEligible: entries.length, series: '3',
      columns: ['code', 'ira'],
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('datauristring').split(',')[1], 'base64').toString('latin1');
    expect(raw).not.toContain('POSI');
  });
});
