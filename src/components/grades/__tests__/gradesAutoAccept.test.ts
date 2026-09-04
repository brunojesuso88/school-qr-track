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

describe('nota existente divergente da nota do PDF', () => {
  const withRule = (on: boolean, extra: Partial<typeof base> = {}) => evaluateAutoAccept({
    ...base, ...extra, detected: detected(), pageHasExistingGrades: true,
    rules: { ...DEFAULT_AUTO_ACCEPT_RULES, use_pdf_grade_on_existing_conflict: on },
  });

  it('sessão antiga sem a chave => regra falsa', () => {
    expect(parseAutoAcceptRules({ use_pdf_registry: true }).use_pdf_grade_on_existing_conflict).toBe(false);
    expect(parseAutoAcceptRules({ use_pdf_grade_on_existing_conflict: true }).use_pdf_grade_on_existing_conflict).toBe(true);
    expect(DEFAULT_AUTO_ACCEPT_RULES.use_pdf_grade_on_existing_conflict).toBe(false);
  });

  it('nota existente idêntica (sem conflito) continua elegível', () => {
    expect(evaluateAutoAccept({ ...base, detected: detected(), pageHasExistingGrades: false }).eligible).toBe(true);
  });

  it('nota divergente com regra desligada bloqueia', () => {
    const r = withRule(false);
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('Nota existente diverge da nota do PDF (aluno + disciplina + período)');
  });

  it('nota divergente com regra ligada não bloqueia e fica registrada como exceção', () => {
    const r = withRule(true);
    expect(r.eligible).toBe(true);
    expect(r.reasons).not.toContain('Nota existente diverge da nota do PDF (aluno + disciplina + período)');
    expect(r.appliedExceptionCodes).toContain('pdf_grade_over_existing');
    expect(r.appliedExceptions).toContain('Nota do PDF autorizada para substituir a existente');
  });

  it('regra ligada não libera outros bloqueadores reais', () => {
    expect(withRule(true, { rows: [{ ...divRow({ flags: ['invalid_value'] }) }] }).eligible).toBe(false);
    expect(evaluateAutoAccept({
      ...base, detected: detected({ status: 'unmatched' }), pageHasExistingGrades: true,
      rules: { ...DEFAULT_AUTO_ACCEPT_RULES, use_pdf_grade_on_existing_conflict: true },
    }).eligible).toBe(false);
    expect(withRule(true, { classDecisionPending: true }).eligible).toBe(false);
  });

  it('regras antigas continuam independentes da nova', () => {
    const rules = parseAutoAcceptRules({
      use_pdf_registry: true, accept_unique_fuzzy: true, use_local_on_reconciliation: true,
    });
    expect(rules).toEqual({
      use_pdf_registry: true, accept_unique_fuzzy: true,
      use_local_on_reconciliation: true, use_pdf_grade_on_existing_conflict: false,
    });
  });
});


describe('exceção: aluno não identificado vinculado/criado automaticamente', () => {
  const baseDetected = {
    status: 'unmatched' as const,
    student_id: null,
    match_score: 0,
    conflicts: [] as string[],
    pdf_name: 'ALUNO NOVO',
    pdf_code: null,
    pdf_birth_date: null,
    pdf_mother_name: null,
    pdf_father_name: null,
    current: null,
  } as never;

  const run = (overrides: Record<string, unknown>) => evaluateAutoAccept({
    detected: baseDetected,
    rows: [],
    classDecisionPending: false,
    pageHasExistingGrades: false,
    linkedStudentId: null,
    suggestedStudentId: null,
    regDecision: null,
    rules: { ...DEFAULT_AUTO_ACCEPT_RULES, auto_create_or_link_unmatched_student: true },
    ...overrides,
  } as never);

  it('desbloqueia a página e registra a exceção aplicada', () => {
    const res = run({});
    expect(res.eligible).toBe(true);
    expect(res.appliedExceptionCodes).toContain('auto_student_link');
  });

  it('desbloqueia aluno localizado em outra turma (candidato único)', () => {
    const res = run({ otherClassMatch: true });
    expect(res.eligible).toBe(true);
    expect(res.appliedExceptions.join(' ')).toMatch(/outra turma/i);
  });

  it('nunca vale para aluno ambíguo ou homônimo', () => {
    const res = run({ detected: { ...(baseDetected as never as object), conflicts: ['ambiguous_match'] } });
    expect(res.eligible).toBe(false);
    expect(res.reasons).toContain('Aluno ambíguo ou homônimo na turma');
  });

  it('mantém bloqueio de nota inválida', () => {
    const res = run({ rows: [{ subject: 'Mat', period: '1º Período', value: null, flags: ['invalid_value'] }] });
    expect(res.eligible).toBe(false);
    expect(res.reasons).toContain('Nota inválida na página');
  });

  it('sem a exceção, aluno não identificado continua bloqueando', () => {
    const res = run({ rules: DEFAULT_AUTO_ACCEPT_RULES });
    expect(res.eligible).toBe(false);
    expect(res.reasons).toContain('Aluno não identificado na turma');
  });
});
