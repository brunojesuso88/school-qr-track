import { describe, expect, it } from 'vitest';
import { reconcileLocalWithAi } from '../reconcile';

const localPreview = {
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
});