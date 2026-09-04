import { describe, expect, it } from 'vitest';
import { reconcileLocalWithAi } from '../reconcile';

interface TestRow {
  subject: string;
  period: string;
  raw_value: string | null;
  value: number | null;
  flags: string[];
  source: string;
  second_pass_value?: string | null;
}

const localPreview: {
  rows: TestRow[];
  notes: string[];
  stats: Record<string, number>;
  reading: { mode: string; escalated: boolean; reasons: string[]; local_score: number; divergences: number };
} = {
  rows: [
    { subject: 'ARTE', period: '1º Período', raw_value: '7,00', value: 7, flags: [], source: 'local' },
    { subject: 'ARTE', period: '2º Período', raw_value: '0,00', value: 0, flags: ['explicit_zero'], source: 'local' },
    { subject: 'BIOLOGIA', period: '1º Período', raw_value: null, value: null, flags: ['empty_cell'], source: 'local' },
  ],
  notes: [],
  stats: {},
  reading: { mode: 'local', escalated: false, reasons: [], local_score: 1, divergences: 0 },
};

describe('reconcileLocalWithAi', () => {
  it('mantém o valor local e sinaliza divergência sem sobrescrever', () => {
    const { preview, divergences } = reconcileLocalWithAi(localPreview, {
      rows: [
        { subject: 'ARTE', period: '1º Período', raw_value: '7,00', value: 7 },
        { subject: 'ARTE', period: '2º Período', raw_value: '9,00', value: 9 },
        { subject: 'BIOLOGIA', period: '1º Período', raw_value: '5,00', value: 5 },
      ],
    });
    expect(divergences).toBe(2);
    const rows = preview.rows;
    expect(rows[0].flags).toContain('reconciled_match');
    expect(rows[1].value).toBe(0);
    expect(rows[1].raw_value).toBe('0,00');
    expect(rows[1].flags).toContain('reconciliation_divergence');
    expect(rows[1].second_pass_value).toBe('9,00');
    expect(rows[2].value).toBeNull();
    expect(rows[2].flags).toContain('reconciliation_divergence');
    expect(preview.reading.mode).toBe('local_validated');
    expect(preview.reading.divergences).toBe(2);
  });

  it('células vistas só pela IA entram como divergência para revisão humana', () => {
    const { preview, divergences } = reconcileLocalWithAi(localPreview, {
      rows: [
        { subject: 'ARTE', period: '1º Período', raw_value: '7,00', value: 7 },
        { subject: 'ARTE', period: '2º Período', raw_value: '0,00', value: 0 },
        { subject: 'BIOLOGIA', period: '1º Período', raw_value: null, value: null },
        { subject: 'QUIMICA', period: '1º Período', raw_value: '8,00', value: 8 },
      ],
    });
    expect(divergences).toBe(1);
    const extra = preview.rows.find((r) => r.subject === 'QUIMICA');
    expect(extra?.source).toBe('ai');
    expect(extra?.flags).toContain('reconciliation_divergence');
  });

  /** Prévia local mínima com as notas informadas por período. */
  const localWith = (subject: string, notas: [string, number][]) => ({
    rows: notas.map(([raw, value], i) => ({
      subject, period: `${i + 1}º Período`, raw_value: raw, value, flags: [], source: 'local',
    })),
    notes: [], stats: {},
    reading: { mode: 'local', escalated: false, reasons: [], local_score: 1, divergences: 0 },
  });

  it('captura da auditoria: 8,00 e 7,50 em APROFUNDAMENTO IF - CNS - I casam com o canônico', () => {
    const local = localWith('APROFUNDAMENTO IF - I', [['8,00', 8], ['7,50', 7.5]]);
    const { preview, divergences, aiOnlyNumericIgnored } = reconcileLocalWithAi(local, {
      rows: [
        { subject: 'APROFUNDAMENTO IF - CNS - I', period: '1º Período', raw_value: '8,00', value: 8 },
        { subject: 'APROFUNDAMENTO IF - CNS - I', period: '2º Período', raw_value: '7,50', value: 7.5 },
      ],
    });
    expect(divergences).toBe(0);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0].flags).toContain('reconciled_match');
    expect(preview.rows[1].flags).toContain('reconciled_match');
    expect(preview.rows.some((r) => r.source === 'ai')).toBe(false);
    expect(aiOnlyNumericIgnored).toBe(0);
  });

  it.each([
    ['CHL', 'I'], ['CNS', 'I'], ['ETT', 'I'],
    ['CHL', 'II'], ['CNS', 'II'], ['ETT', 'II'],
  ])('eixo %s - %s casa com o canônico correspondente', (eixo, ordem) => {
    const local = localWith(`APROFUNDAMENTO IF - ${ordem}`, [['8,00', 8], ['7,50', 7.5]]);
    const { preview, divergences, aiOnlyNumericIgnored } = reconcileLocalWithAi(local, {
      rows: [
        { subject: `Aprofundamento IF - ${eixo} - ${ordem}`, period: '1º Período', raw_value: '8,00', value: 8 },
        { subject: `Aprofundamento IF - ${eixo} - ${ordem}`, period: '2º Período', raw_value: '7,50', value: 7.5 },
      ],
    });
    expect(divergences).toBe(0);
    expect(aiOnlyNumericIgnored).toBe(0);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.every((r) => (r.flags ?? []).includes('reconciled_match'))).toBe(true);
    expect(preview.rows.some((r) => r.source === 'ai')).toBe(false);
  });

  it.each(['CHL', 'CNS', 'ETT'])('%s - II nunca casa com o canônico I', (eixo) => {
    const local = localWith('APROFUNDAMENTO IF - I', [['8,00', 8]]);
    const { preview, divergences } = reconcileLocalWithAi(local, {
      rows: [{ subject: `Aprofundamento IF - ${eixo} - II`, period: '1º Período', raw_value: '9,00', value: 9 }],
    });
    expect(divergences).toBe(1);
    expect(preview.rows).toHaveLength(2);
  });
});