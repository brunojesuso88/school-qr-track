import { describe, expect, it } from 'vitest';
import {
  applyResolvedStudentToDetected, REGISTRY_CONFLICTS, shouldStartRegistration, stripRegistryRowFlags,
} from '../registrationResolution';
import { decideStudentResolution } from '../autoStudentResolution';
import { evaluateAutoAccept } from '@/components/grades/gradesAutoAccept';
import { DetectedStudent } from '@/components/grades/gradesConflicts';
import { manualConfirmationBlockers } from '@/components/grades/gradesManualConfirm';
import { ReviewRow } from '@/components/grades/GradesReviewTable';

const detected = (over: Partial<DetectedStudent> = {}): DetectedStudent => ({
  key: 'a', pdf_name: 'ANA SILVA', pdf_code: '26123456', pdf_birth_date: null,
  pdf_mother_name: null, pdf_father_name: null, pages: [1], cells: 4,
  student_id: null, matched_name: null, match_score: 0, status: 'unmatched',
  conflicts: ['not_in_class'],
  current: { school_code: null, birth_date: null, mother_name: null, father_name: null, student_id: null },
  ...over,
});

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  student_name: 'ANA SILVA', subject: 'FISICA', period: '2º Período',
  raw_value: '8,X0', value: null, page: 1, source_page: 1, confidence: 0.4,
  student_id: null, matched_name: null, match_score: 0,
  flags: ['invalid_value', 'unmatched_student'], source: 'local',
  ...over,
});

describe('separação cadastro × elegibilidade acadêmica', () => {
  it('aluno novo + nota inválida: cadastro é resolvido, gravação continua bloqueada', () => {
    const d = detected();
    const rows = [row()];

    // 1) A decisão cadastral NÃO depende da qualidade das notas.
    const decision = decideStudentResolution({
      ruleActive: true, conflicts: d.conflicts, pdfName: d.pdf_name,
      suggestedStudentId: null, otherClassStudentId: null,
    });
    expect(decision.action).toBe('create');

    // 2) Resolução cadastral concluída (aluno criado/vinculado), SEM gravar notas.
    let savedGrades = 0;
    const resolvedDetected = applyResolvedStudentToDetected(d, { studentId: 's-new', fullName: 'ANA SILVA' });
    const resolvedRows = stripRegistryRowFlags(rows);
    expect(resolvedDetected.student_id).toBe('s-new');
    expect(resolvedDetected.status).toBe('matched');
    expect(resolvedDetected.conflicts.some((c) => REGISTRY_CONFLICTS.includes(c))).toBe(false);
    expect(resolvedRows[0].flags).not.toContain('unmatched_student');
    expect(savedGrades).toBe(0);

    // 3) O problema acadêmico permanece: nada é elegível/gravado.
    expect(resolvedRows[0].flags).toContain('invalid_value');
    expect(manualConfirmationBlockers(resolvedRows).length).toBeGreaterThan(0);
    const evaluation = evaluateAutoAccept({
      detected: resolvedDetected, rows: resolvedRows, classDecisionPending: false,
      pageHasExistingGrades: false, linkedStudentId: 's-new', suggestedStudentId: 's-new', regDecision: null,
    });
    expect(evaluation.eligible).toBe(false);
    if (evaluation.eligible) savedGrades += resolvedRows.length;
    expect(savedGrades).toBe(0);
  });

  it('conflitos acadêmicos nunca são limpos pela resolução cadastral', () => {
    const d = detected({ conflicts: ['not_in_class', 'invalid_value', 'local_ai_divergence', 'existing_grade_conflict'] });
    const out = applyResolvedStudentToDetected(d, { studentId: 's1', fullName: 'ANA SILVA' });
    expect(out.conflicts).toEqual(['invalid_value', 'local_ai_divergence', 'existing_grade_conflict']);
  });

  it('lock impede concorrência e libera para retry após falha', () => {
    expect(shouldStartRegistration({ key: null, phase: 'idle' }, 'p:1')).toBe(true);
    expect(shouldStartRegistration({ key: 'p:1', phase: 'running' }, 'p:1')).toBe(false);
    expect(shouldStartRegistration({ key: 'p:1', phase: 'resolved' }, 'p:1')).toBe(false);
    expect(shouldStartRegistration({ key: 'p:1', phase: 'failed' }, 'p:1')).toBe(true);
    expect(shouldStartRegistration({ key: 'p:1', phase: 'resolved' }, 'p:2')).toBe(true);
  });

  it('ambiguidade e vínculo duplicado nunca são automatizados', () => {
    expect(decideStudentResolution({
      ruleActive: true, conflicts: ['ambiguous_match'], pdfName: 'ANA SILVA',
      suggestedStudentId: null, otherClassStudentId: null,
    }).action).toBe('manual');
    expect(decideStudentResolution({
      ruleActive: true, conflicts: ['duplicate_link'], pdfName: 'ANA SILVA',
      suggestedStudentId: 's1', otherClassStudentId: null,
    }).action).toBe('manual');
  });
});
