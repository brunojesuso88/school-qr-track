import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_ACCEPT_RULES, evaluateAutoAccept } from '../gradesAutoAccept';
import { DetectedStudent } from '../gradesConflicts';

const detected = (over: Partial<DetectedStudent> = {}): DetectedStudent => ({
  key: 'a', pdf_name: 'ANA SILVA', pdf_code: '26123456', pdf_birth_date: null,
  pdf_mother_name: null, pdf_father_name: null, pages: [1], cells: 4,
  student_id: 's1', matched_name: 'ANA SILVA', match_score: 1, status: 'matched',
  conflicts: [], current: { school_code: '26123456', birth_date: null, mother_name: null, father_name: null, student_id: null },
  ...over,
});

const base = {
  rows: [], classDecisionPending: false, pageHasExistingGrades: false,
  linkedStudentId: 's1', suggestedStudentId: 's1', regDecision: null,
};

describe('autoaceite', () => {
  it('página limpa é elegível sem exceções', () => {
    expect(evaluateAutoAccept({ ...base, detected: detected() }).eligible).toBe(true);
  });

  it('divergência cadastral bloqueia por padrão e libera com a exceção de admin', () => {
    const d = detected({ conflicts: ['code_mismatch'], current: { school_code: '999', birth_date: null, mother_name: null, father_name: null, student_id: null } });
    expect(evaluateAutoAccept({ ...base, detected: d }).eligible).toBe(false);
    const ok = evaluateAutoAccept({
      ...base, detected: d, rules: { ...DEFAULT_AUTO_ACCEPT_RULES, use_pdf_registry: true }, canUsePdfRegistry: true,
    });
    expect(ok.eligible).toBe(true);
    expect(ok.appliedExceptions.length).toBe(1);
  });

  it('exceção cadastral não vale sem permissão', () => {
    const d = detected({ conflicts: ['code_mismatch'] });
    expect(evaluateAutoAccept({
      ...base, detected: d, rules: { ...DEFAULT_AUTO_ACCEPT_RULES, use_pdf_registry: true }, canUsePdfRegistry: false,
    }).eligible).toBe(false);
  });

  it('fuzzy único libera só com a exceção; ambiguidade nunca libera', () => {
    const fuzzy = detected({ status: 'fuzzy', match_score: 0.9, conflicts: ['name_similar'] });
    expect(evaluateAutoAccept({ ...base, detected: fuzzy }).eligible).toBe(false);
    expect(evaluateAutoAccept({
      ...base, detected: fuzzy, rules: { ...DEFAULT_AUTO_ACCEPT_RULES, accept_unique_fuzzy: true },
    }).eligible).toBe(true);
    const amb = detected({ status: 'fuzzy', match_score: 0.9, conflicts: ['ambiguous_match'] });
    expect(evaluateAutoAccept({
      ...base, detected: amb, rules: { ...DEFAULT_AUTO_ACCEPT_RULES, accept_unique_fuzzy: true },
    }).eligible).toBe(false);
  });

  it('aluno de outra turma e conflito de notas sempre bloqueiam', () => {
    expect(evaluateAutoAccept({ ...base, detected: detected(), otherClassMatch: true }).eligible).toBe(false);
    expect(evaluateAutoAccept({ ...base, detected: detected(), pageHasExistingGrades: true }).eligible).toBe(false);
  });
});
