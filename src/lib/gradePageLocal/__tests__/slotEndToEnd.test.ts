/**
 * Ocorrências repetidas (slots) do MESMO componente da Matriz Integral,
 * ponta a ponta: leitura local separa as notas, a reconciliação com a IA não
 * colide as chaves e o IRA aritmético conta as duas linhas.
 */
import { describe, expect, it } from 'vitest';
import { reconcileLocalWithAi } from '../reconcile';
import { calculateIraMultiPeriod } from '@/lib/ira';

const NAME = 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS';

const row = (slot: number, value: number) => ({
  subject: NAME,
  slot_index: slot,
  period: '1º Período',
  raw_value: value.toFixed(2).replace('.', ','),
  value,
  flags: [] as string[],
  source: 'local',
});

describe('slots do mesmo componente ponta a ponta', () => {
  it('reconcile não colide as chaves das duas ocorrências', () => {
    const local = { rows: [row(1, 8), row(2, 6)] };
    const ai = { rows: [row(1, 8), row(2, 6)] };
    const res = reconcileLocalWithAi(local, ai, { localAuthoritative: true });
    const rows = (res.preview as typeof local).rows;
    expect(rows).toHaveLength(2);
    expect(res.divergences).toBe(0);
    expect(rows.map((r) => r.value)).toEqual([8, 6]);
    expect(rows.every((r) => (r.flags ?? []).includes('reconciled_match'))).toBe(true);
  });

  it('divergência da IA no slot 2 não contamina o slot 1', () => {
    const local = { rows: [row(1, 8), row(2, 6)] };
    const ai = { rows: [row(1, 8), row(2, 9)] };
    const res = reconcileLocalWithAi(local, ai, { localAuthoritative: true });
    const rows = (res.preview as typeof local).rows;
    expect(res.divergences).toBe(1);
    expect(rows[0].flags).toContain('reconciled_match');
    expect(rows[1].flags).toContain('ai_validation_disagreement');
    // Leitura local permanece a verdade exibida.
    expect(rows[1].value).toBe(6);
  });

  it('IRA conta as duas ocorrências com o MESMO algoritmo ponderado: 8 e 6 => 7,00', () => {
    const ira = calculateIraMultiPeriod(
      [
        {
          subjectId: 'gs-slot-1', name: NAME, weeklyClasses: 1, includeInIra: true,
          customWeight: null, valuesByPeriod: { p1: 8 },
        },
        {
          subjectId: 'gs-slot-2', name: NAME, weeklyClasses: 1, includeInIra: true,
          customWeight: null, valuesByPeriod: { p1: 6 },
        },
      ],
      [{ id: 'p1', label: '1º Período' }],
    );
    // Dois grade_subjects distintos (unique class_id + normalized_name + slot_index).
    expect(new Set(ira.lines.map((l) => l.subjectId)).size).toBe(2);
    expect(ira.totalWeight).toBe(2);
    expect(ira.value).toBeCloseTo(7, 10);
  });
});
