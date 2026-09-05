import { describe, expect, it } from 'vitest';
import { buildSubjectAnchors, matchSubjectAnchor } from '../subjectAnchors';
import { INTEGRAL_MATRIX_SUBJECTS } from '@/lib/curriculumIntegralData';
import { LocalExpectedSubject } from '../types';

const expected = (names: string[]): LocalExpectedSubject[] =>
  names.map((name, i) => ({ name, slot_index: 1, weekly_classes: 0, aliases: [], abbreviation: null, sort_order: i } as LocalExpectedSubject));

describe('nome longo quebrado em duas linhas (espaço perdido)', () => {
  const anchors = buildSubjectAnchors(expected([
    'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS',
    'GESTAO DE EVENTOS: PLANEJAMENTO E EXECUCAO',
    'MARKETING EM EVENTOS',
  ]));

  it('casa o nome sem o espaço com a disciplina correta', () => {
    const match = matchSubjectAnchor('ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS', anchors);
    expect(match?.anchor.canonical).toBe('ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS');
  });

  it('não colapsa disciplinas distintas', () => {
    expect(matchSubjectAnchor('MARKETINGEM EVENTOS', anchors)?.anchor.canonical).toBe('MARKETING EM EVENTOS');
    const letramento = buildSubjectAnchors(expected(['LETRAMENTO EM MATEMATICA', 'MATEMATICA']));
    expect(matchSubjectAnchor('MATEMATICA', letramento)?.anchor.canonical).toBe('MATEMATICA');
  });

  it('a matriz oficial usa o nome com o espaço correto', () => {
    expect(INTEGRAL_MATRIX_SUBJECTS.eve2).toContain('ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS');
    Object.values(INTEGRAL_MATRIX_SUBJECTS).forEach((names) => {
      expect(names.some((n) => n.includes('DEEVENTOS'))).toBe(false);
    });
  });
});
