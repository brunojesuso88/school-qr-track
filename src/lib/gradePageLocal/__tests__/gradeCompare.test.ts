import { describe, expect, it } from 'vitest';
import { analyzeDivergences } from '@/components/grades/gradesAutoAccept';
import { reconcileLocalWithAi } from '../reconcile';
import { matchesSecondPass, stripReconciliationFlags } from '../gradeCompare';
import { ReviewRow } from '@/components/grades/GradesReviewTable';

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  student_name: 'ADELLYA FERREIRA DA SILVA',
  subject: 'MATEMATICA',
  period: '1º Período',
  raw_value: '8,00',
  value: 8,
  page: 1,
  confidence: 1,
  student_id: 'x',
  matched_name: 'ADELLYA FERREIRA DA SILVA',
  match_score: 1,
  flags: ['reconciliation_divergence'],
  second_pass_value: '8,00',
  source: 'manual',
  ...over,
});

describe('comparação semântica de notas', () => {
  it('flag stale com valores iguais não é divergência', () => {
    expect(analyzeDivergences([row({})]).divergences).toHaveLength(0);
  });

  it.each([
    [8, '8,00'],
    [8, '8.00'],
    [7.5, '7,5'],
    [0, '0'],
    [null, '—'],
    [null, ''],
  ])('local %s == IA %s', (value, ai) => {
    expect(matchesSecondPass(value as number | null, ai)).toBe(true);
    expect(analyzeDivergences([row({ value, raw_value: String(value ?? ''), second_pass_value: ai })]).divergences).toHaveLength(0);
  });

  it('null != 0', () => {
    expect(matchesSecondPass(null, '0,00')).toBe(false);
  });

  it('divergência real permanece', () => {
    const res = analyzeDivergences([row({ second_pass_value: '7,00' })]);
    expect(res.divergences).toHaveLength(1);
    expect(res.hasDivergence).toBe(true);
  });

  it('IA-only com nota real permanece revisão obrigatória', () => {
    const res = analyzeDivergences([row({ source: 'ai', raw_value: '8,00', value: 8, second_pass_value: '8,00' })]);
    expect(res.divergences).toHaveLength(1);
    expect(res.hasAiOnly).toBe(true);
  });

  it('stripReconciliationFlags remove só as flags de reconciliação', () => {
    expect(stripReconciliationFlags(['manual', 'reconciled_match', 'reconciliation_divergence']))
      .toEqual(['manual']);
  });

  it('reconcileLocalWithAi limpa flag stale e marca reconciled_match', () => {
    const { preview, divergences } = reconcileLocalWithAi({
      rows: [{
        subject: 'MATEMATICA', period: '1º Período', raw_value: '8,00', value: 8,
        flags: ['reconciliation_divergence', 'manual'], source: 'manual', second_pass_value: '7,00',
      }],
    }, { rows: [{ subject: 'MATEMATICA', period: '1º Período', raw_value: '8,00', value: 8 }] });
    expect(divergences).toBe(0);
    expect(preview.rows[0].flags).toContain('reconciled_match');
    expect(preview.rows[0].flags).not.toContain('reconciliation_divergence');
    expect(preview.rows[0].flags).toContain('manual');
  });
});
