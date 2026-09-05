import { describe, expect, it } from 'vitest';
import { decideStudentResolution, resolveBeforeCreate } from '../autoStudentResolution';
import { digitsOnly, sameNormalizedName } from '@/lib/gradePageLocal/studentMatch';
import { blockersRequiringAi, decideAiFallback } from '../aiPolicy';
import { validateLocalPage } from '@/lib/gradePageLocal/validate';
import { GridLayout, LocalCell } from '@/lib/gradePageLocal/types';

const helpers = {
  sameCode: (a: unknown, b: unknown) => Boolean(digitsOnly(a)) && digitsOnly(a) === digitsOnly(b),
  sameName: sameNormalizedName,
};

describe('decideStudentResolution', () => {
  const base = {
    ruleActive: true,
    conflicts: [] as string[],
    pdfName: 'MARIA DA SILVA SOUZA',
    suggestedStudentId: null as string | null,
    otherClassStudentId: null as string | null,
  };

  it('nunca resolve automaticamente aluno ambíguo', () => {
    expect(decideStudentResolution({ ...base, conflicts: ['ambiguous_match'], suggestedStudentId: 's1' }))
      .toEqual({ action: 'manual', reason: 'ambiguous_candidates', studentId: null });
    expect(decideStudentResolution({ ...base, conflicts: ['duplicate_link'] }).action).toBe('manual');
  });

  it('vincula o aluno sugerido da própria turma', () => {
    expect(decideStudentResolution({ ...base, suggestedStudentId: 's1' }))
      .toEqual({ action: 'link', reason: 'existing_class_match', studentId: 's1' });
  });

  it('move o candidato forte de outra turma em vez de duplicar', () => {
    expect(decideStudentResolution({ ...base, otherClassStudentId: 's9' }))
      .toEqual({ action: 'move', reason: 'other_class_candidate', studentId: 's9' });
  });

  it('cria somente sem candidato algum e com nome legível', () => {
    expect(decideStudentResolution(base).action).toBe('create');
    expect(decideStudentResolution({ ...base, pdfName: '   ' }).action).toBe('manual');
  });

  it('regra desativada mantém decisão manual', () => {
    expect(decideStudentResolution({ ...base, ruleActive: false, suggestedStudentId: 's1' }).action).toBe('manual');
  });
});

describe('resolveBeforeCreate (reconsulta defensiva)', () => {
  it('vincula quando o código já existe na escola', () => {
    const out = resolveBeforeCreate(
      { name: 'JOAO PEDRO', code: '26.123.456' },
      [{ id: 'a', full_name: 'JOAO P', school_code: '26123456' }],
      helpers,
    );
    expect(out).toEqual({ action: 'link', studentId: 'a' });
  });

  it('vincula por nome idêntico quando não há código', () => {
    const out = resolveBeforeCreate(
      { name: 'ANA MARIA DE SOUZA', code: null },
      [{ id: 'b', full_name: 'Ana Maria de Souza', school_code: null }],
      helpers,
    );
    expect(out).toEqual({ action: 'link', studentId: 'b' });
  });

  it('duas identidades iguais => manual, nunca criação', () => {
    const out = resolveBeforeCreate(
      { name: 'ANA MARIA', code: null },
      [
        { id: 'b', full_name: 'ANA MARIA', school_code: null },
        { id: 'c', full_name: 'Ana Maria', school_code: null },
      ],
      helpers,
    );
    expect(out).toEqual({ action: 'manual', studentId: null });
  });

  it('sem candidato => cria', () => {
    expect(resolveBeforeCreate({ name: 'NOVO ALUNO', code: '99' }, [], helpers).action).toBe('create');
  });
});

describe('IA nunca é chamada por pendência apenas cadastral', () => {
  it('blockersRequiringAi descarta códigos cadastrais', () => {
    expect(blockersRequiringAi(['student_registry_unresolved', 'not_in_class'])).toEqual([]);
    expect(blockersRequiringAi(['invalid_value', 'student_registry_unresolved'])).toEqual(['invalid_value']);
  });

  it('leitura local conclusiva com aluno não vinculado não aciona IA', () => {
    const decision = decideAiFallback(
      {
        ok: true,
        authoritative: false,
        preview: {},
        validation: { conclusive: true, blockers: ['student_registry_unresolved'], reasons: [], score: 0.9 },
        reading: { blockers: [] },
      },
      { mode: 'local_ai', hasLocalDocument: true },
    );
    expect(decision.useAi).toBe(false);
    expect(decision.origin).toBe('local_conclusive');
  });

  it('bloqueante real continua acionando a IA', () => {
    const decision = decideAiFallback(
      {
        ok: true,
        authoritative: false,
        preview: {},
        validation: { conclusive: true, blockers: ['invalid_value'], reasons: [], score: 0.4 },
        reading: { blockers: [] },
      },
      { mode: 'local_ai', hasLocalDocument: true },
    );
    expect(decision.useAi).toBe(true);
  });
});

describe('validateLocalPage separa cadastro de leitura', () => {
  const grid = {
    columns: [{ label: '1º Período', kind: 'period', canonical: '1º Período' }],
    subHeaderLineIndex: 3,
  } as unknown as GridLayout;
  const cells = [
    { subject: 'ARTE', period: '1º Período', raw_value: '7,00', value: 7, invalid: false, confidence: 1 },
  ] as unknown as LocalCell[];
  const input = {
    tokens: Array.from({ length: 80 }, () => ({ text: 'x' })) as never,
    grid,
    cells,
    subjects: ['ARTE'],
    expectedSubjects: [{ name: 'ARTE' }] as never,
    ambiguousCells: 0,
    orphanTokens: 0,
    studentName: 'MARIA SILVA',
    matchScore: 0.2,
  };

  it('aluno lido mas sem vínculo é AVISO, não bloqueante', () => {
    const out = validateLocalPage(input);
    expect(out.advisories).toContain('student_registry_unresolved');
    expect(out.blockers ?? []).not.toContain('student_registry_unresolved');
    expect(out.conclusive).toBe(true);
  });

  it('cabeçalho ilegível continua bloqueante', () => {
    const out = validateLocalPage({ ...input, studentName: null });
    expect(out.blockers).toContain('student_header_missing');
  });
});
