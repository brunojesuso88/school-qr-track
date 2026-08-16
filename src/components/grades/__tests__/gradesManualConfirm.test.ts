import { describe, expect, it } from 'vitest';
import {
  manualConfirmationBlockers, rowsForManualLocalConfirmation, shouldValidateWithAi,
} from '../gradesManualConfirm';
import { analyzeDivergences, evaluateAutoAccept } from '../gradesAutoAccept';

const row = (over: Record<string, unknown> = {}) => ({
  subject: 'ARTE', period: '1º Período', raw_value: '7,00', value: 7,
  flags: [] as string[], source: 'local', confidence: 1, ...over,
}) as never;

describe('confirmação manual soberana', () => {
  it('remove linhas da IA e flags de reconciliação, preservando flags acadêmicas', () => {
    const rows = [
      row({ flags: ['reconciliation_divergence', 'explicit_zero'], value: 0, raw_value: '0,00' }),
      row({ subject: 'QUIMICA', source: 'ai', flags: ['reconciliation_divergence'] }),
    ];
    const out = rowsForManualLocalConfirmation(rows);
    expect(out).toHaveLength(1);
    expect(out[0].flags).toEqual(['explicit_zero']);
  });

  it('continua bloqueando erro real de leitura', () => {
    expect(manualConfirmationBlockers([row({ flags: ['out_of_scale'] })])).toEqual(['out_of_scale']);
    expect(manualConfirmationBlockers([row({ flags: ['reconciliation_divergence'] })])).toEqual([]);
  });
});

describe('política de uso da IA', () => {
  it('dispensa a IA quando a leitura local é autoritativa', () => {
    expect(shouldValidateWithAi({ mode: 'local_ai', localOk: true, localAuthoritative: true })).toBe(false);
    expect(shouldValidateWithAi({ mode: 'local_ai', localOk: true, localAuthoritative: false })).toBe(true);
    expect(shouldValidateWithAi({ mode: 'always_ai', localOk: true, localAuthoritative: true })).toBe(true);
  });
});

describe('discordância informativa da IA', () => {
  it('não bloqueia o autoaceite', () => {
    const rows = [row({ flags: ['ai_validation_disagreement'], second_pass_value: '9,00' })];
    const diag = analyzeDivergences(rows);
    expect(diag.hasDivergence).toBe(true);
    expect(diag.onlyAdvisory).toBe(true);
    const res = evaluateAutoAccept({
      detected: { status: 'matched', match_score: 1, conflicts: [], pdf_code: null, pdf_birth_date: null,
        pdf_mother_name: null, pdf_father_name: null, current: null } as never,
      rows, classDecisionPending: false, pageHasExistingGrades: false,
      linkedStudentId: 'a', suggestedStudentId: 'a', regDecision: null,
    });
    expect(res.reasons).not.toContain('Divergência entre leituras');
    expect(res.eligible).toBe(true);
  });
});
