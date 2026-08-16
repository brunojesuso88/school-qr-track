import { describe, expect, it } from 'vitest';
import {
  analyzeDivergences, DEFAULT_AUTO_ACCEPT_RULES, evaluateAutoAccept, parseAutoAcceptRules,
} from '../gradesAutoAccept';
import { DetectedStudent } from '../gradesConflicts';
import { ReviewRow } from '../GradesReviewTable';

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

const divRow = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  student_name: 'ANA SILVA', subject: 'FISICA', period: '2º Período',
  raw_value: '8,50', value: 8.5, page: 12, source_page: 12, confidence: 0.98,
  student_id: 's1', matched_name: 'ANA SILVA', match_score: 1,
  flags: ['reconciliation_divergence'], second_pass_value: '6,50', source: 'local',
  ...over,
});

const withRules = (rows: ReviewRow[], on: boolean, extra: Partial<typeof base> = {}) => evaluateAutoAccept({
  ...base, ...extra, detected: detected(), rows,
  rules: { ...DEFAULT_AUTO_ACCEPT_RULES, use_local_on_reconciliation: on },
});

describe('divergência LOCAL × IA no autoaceite', () => {
  it('local 8,5 × IA 6,5 com a regra desligada bloqueia', () => {
    const r = withRules([divRow()], false);
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('Divergência entre leituras');
    expect(r.divergenceOnlyBlocker).toBe(true);
    expect(r.divergences[0].local_raw).toBe('8,50');
    expect(r.divergences[0].ai_raw).toBe('6,50');
  });

  it('local 8,5 × IA 6,5 com a regra ligada autoaceita mantendo o valor local', () => {
    const r = withRules([divRow()], true);
    expect(r.eligible).toBe(true);
    expect(r.appliedExceptionCodes).toContain('local_reconciliation');
    expect(r.appliedExceptions).toContain('Leitura local do boletim adotada em divergência de validação');
  });

  it('vazio local legítimo × IA 7,0 com a regra ligada autoaceita mantendo null', () => {
    const row = divRow({ raw_value: null, value: null, second_pass_value: '7,00', flags: ['empty_cell', 'reconciliation_divergence'] });
    const r = withRules([row], true);
    expect(r.eligible).toBe(true);
    expect(r.divergences[0].local_value).toBeNull();
  });

  it('célula vista somente pela IA nunca autoaceita', () => {
    const r = withRules([divRow({ source: 'ai' })], true);
    expect(r.eligible).toBe(false);
    expect(r.divergences[0].ai_only).toBe(true);
    expect(analyzeDivergences([divRow({ source: 'ai' })]).allLocallyEligible).toBe(false);
  });

  it('divergência com baixa confiança nunca autoaceita', () => {
    const r = withRules([divRow({ flags: ['reconciliation_divergence', 'low_confidence'] })], true);
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('Célula com baixa confiança');
  });

  it('divergência com valor inválido nunca autoaceita', () => {
    const r = withRules([divRow({ flags: ['reconciliation_divergence', 'invalid_value'] })], true);
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('Nota inválida na página');
  });

  it('divergência com nota existente diferente nunca autoaceita', () => {
    const r = withRules([divRow()], true, { pageHasExistingGrades: true });
    expect(r.eligible).toBe(false);
  });

  it('sessão retomada preserva use_local_on_reconciliation e tolera sessões antigas', () => {
    expect(parseAutoAcceptRules({ use_local_on_reconciliation: true }).use_local_on_reconciliation).toBe(true);
    expect(parseAutoAcceptRules({ use_pdf_registry: true }).use_local_on_reconciliation).toBe(false);
    expect(parseAutoAcceptRules(null)).toEqual(DEFAULT_AUTO_ACCEPT_RULES);
  });

  it('confirmation_mode registra local_reconciliation quando aplicado', () => {
    const r = withRules([divRow()], true);
    expect(`auto:${r.appliedExceptionCodes.join(',')}`).toBe('auto:local_reconciliation');
  });
});
