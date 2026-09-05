/**
 * Ao resolver o aluno, TODAS as linhas da prévia passam a apontar para ele
 * (`student_id` + `matched_name`), e só as flags CADASTRAIS são removidas.
 */
import { describe, expect, it } from 'vitest';
import { applyResolvedStudentToRows } from '../registrationResolution';
import { ReviewRow } from '@/components/grades/GradesReviewTable';

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  student_name: 'ANA SILVA', subject: 'FISICA', period: '2º Período',
  raw_value: '8,00', value: 8, page: 1, source_page: 1, confidence: 0.9,
  student_id: null, matched_name: null, match_score: 0,
  flags: [], source: 'local',
  ...over,
});

const identity = { studentId: 's-new', fullName: 'ANA SILVA' };

describe('sincronização das linhas após resolver o aluno', () => {
  it('preenche student_id e matched_name em todas as linhas', () => {
    const rows = [
      row({ flags: ['unmatched_student'] }),
      row({ subject: 'QUIMICA', student_id: 's-antigo', matched_name: 'OUTRO NOME' }),
      row({ subject: 'BIOLOGIA', period: '3º Período' }),
    ];
    const out = applyResolvedStudentToRows(rows, identity);
    expect(out).toHaveLength(3);
    out.forEach((r) => {
      expect(r.student_id).toBe('s-new');
      expect(r.matched_name).toBe('ANA SILVA');
      expect(r.flags).not.toContain('unmatched_student');
    });
  });

  it('preserva TODAS as flags acadêmicas', () => {
    const academic = [
      'invalid_value', 'out_of_scale', 'local_ai_divergence',
      'reconciliation_divergence', 'existing_grade_conflict',
    ];
    const out = applyResolvedStudentToRows(
      [row({ flags: [...academic, 'unmatched_student'] })],
      identity,
    );
    expect(out[0].flags).toEqual(academic);
  });

  it('não altera valores, páginas nem origem da leitura', () => {
    const original = row({ raw_value: '7,50', value: 7.5, source_page: 4, page: 4, source: 'ai' });
    const [out] = applyResolvedStudentToRows([original], identity);
    expect(out.raw_value).toBe('7,50');
    expect(out.value).toBe(7.5);
    expect(out.source_page).toBe(4);
    expect(out.page).toBe(4);
    expect(out.source).toBe('ai');
  });

  it('é seguro com lista vazia', () => {
    expect(applyResolvedStudentToRows([], identity)).toEqual([]);
  });
});
