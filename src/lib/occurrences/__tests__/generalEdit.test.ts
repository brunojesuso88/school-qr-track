import { describe, it, expect } from 'vitest';
import { canEditGeneralOccurrence, buildGeneralOccurrenceUpdate } from '../generalEdit';

const occ = { id: 'o1', created_by: 'u1' };

describe('canEditGeneralOccurrence', () => {
  it('o autor pode editar', () => {
    expect(canEditGeneralOccurrence(occ, 'u1', false)).toBe(true);
  });

  it('quem não é autor não pode editar', () => {
    expect(canEditGeneralOccurrence(occ, 'u2', false)).toBe(false);
  });

  it('visitante/sem sessão não pode editar', () => {
    expect(canEditGeneralOccurrence(occ, null, false)).toBe(false);
  });

  it('preserva o acesso administrativo já existente', () => {
    expect(canEditGeneralOccurrence(occ, 'u2', true)).toBe(true);
  });

  it('ocorrência antiga sem autor não libera edição para qualquer um', () => {
    expect(canEditGeneralOccurrence({ id: 'o2', created_by: null }, 'u1', false)).toBe(false);
  });
});

describe('buildGeneralOccurrenceUpdate', () => {
  it('atualiza apenas campos editáveis (id/escola/aluno/autor intactos)', () => {
    const patch = buildGeneralOccurrenceUpdate({
      type: 'late_arrival',
      description: 'Chegou 07:20',
      date: '2026-09-16',
    });
    expect(patch).toEqual({
      type: 'late_arrival',
      description: 'Chegou 07:20',
      date: '2026-09-16',
      end_date: null,
    });
    expect(Object.keys(patch)).not.toContain('school_id');
    expect(Object.keys(patch)).not.toContain('student_id');
    expect(Object.keys(patch)).not.toContain('created_by');
    expect(Object.keys(patch)).not.toContain('id');
    expect(Object.keys(patch)).not.toContain('created_at');
  });

  it('mantém o período do atestado quando informado', () => {
    expect(
      buildGeneralOccurrenceUpdate({
        type: 'medical_certificate',
        description: null,
        date: '2026-09-10',
        endDate: '2026-09-14',
      }).end_date,
    ).toBe('2026-09-14');
  });
});
