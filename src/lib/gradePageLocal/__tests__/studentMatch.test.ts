import { describe, it, expect } from 'vitest';
import {
  digitsOnly, findGlobalMatch, matchStudentInClass, nameTokens, pickClassName, tokenSetSimilarity,
} from '../studentMatch';

const s = (id: string, full_name: string, school_code: string | null = null, klass = 'A') =>
  ({ id, full_name, school_code, class: klass });

describe('normalização', () => {
  it('compara códigos ignorando pontuação e zeros à esquerda', () => {
    expect(digitsOnly('0012.345-6')).toBe('123456');
    expect(digitsOnly('123456')).toBe('123456');
    expect(digitsOnly('abc')).toBe('');
  });
  it('ignora partículas e acentos nos tokens', () => {
    expect(nameTokens('José da Silva de Souza')).toEqual(['jose', 'silva', 'souza']);
    expect(tokenSetSimilarity('MARIA DAS DORES', 'Maria Dores')).toBe(1);
  });
});

describe('matchStudentInClass', () => {
  const students = [s('1', 'Ana Paula Souza', '1001'), s('2', 'Bruno Lima', '1002')];

  it('vincula por código mesmo com nome divergente', () => {
    const out = matchStudentInClass({ name: 'ANA P. SOUZA', code: '0001001' }, students);
    expect(out.status).toBe('matched');
    expect(out.by).toBe('code');
    expect(out.student?.id).toBe('1');
  });

  it('vincula por nome exato com acento/ordem diferentes', () => {
    const out = matchStudentInClass({ name: 'ana paula de souza', code: null }, students);
    expect(out.status).toBe('matched');
    expect(out.student?.id).toBe('1');
  });

  it('código repetido na turma não trava: cai para o nome', () => {
    const messy = [s('1', 'Angela Oliveira Santos', '24'), s('2', 'Carlos Eduardo de Lima Dutra', '24')];
    const out = matchStudentInClass({ name: 'CARLOS EDUARDO DE LIMA DUTRA', code: '24' }, messy);
    expect(out.status).toBe('matched');
    expect(out.student?.id).toBe('2');
  });

  it('desempata homônimos pelo código quando isola um deles', () => {
    const twins = [s('1', 'Ana Souza', '1001'), s('2', 'Ana Souza', '2002')];
    const out = matchStudentInClass({ name: 'Ana Souza', code: '2002' }, twins);
    expect(out.status).toBe('matched');
    expect(out.student?.id).toBe('2');
  });

  it('marca ambiguidade quando dois alunos batem pelo nome', () => {
    const dup = [s('1', 'Ana Souza'), s('2', 'Ana Souza')];
    const out = matchStudentInClass({ name: 'Ana Souza' }, dup);
    expect(out.status).toBe('ambiguous');
    expect(out.student).toBeNull();
    expect(out.candidates).toHaveLength(2);
  });

  it('não vincula nomes apenas parecidos abaixo de 0,85', () => {
    const out = matchStudentInClass({ name: 'Carlos Eduardo Matos' }, students);
    expect(out.status).toBe('unmatched');
    expect(out.student).toBeNull();
  });

  it('sugere (fuzzy) quando há exatamente um candidato acima do limiar', () => {
    const out = matchStudentInClass({ name: 'Ana Paula Souza Lima' }, [s('1', 'Ana Paula Souza')]);
    expect(out.status).toBe('fuzzy');
    expect(out.student?.id).toBe('1');
  });

  it('turma sem contexto nunca gera vínculo', () => {
    expect(matchStudentInClass({ name: 'Ana Paula Souza', code: '1001' }, []).status).toBe('unmatched');
  });
});

describe('findGlobalMatch', () => {
  it('encontra aluno de outra turma por código', () => {
    const out = findGlobalMatch({ name: 'Outro Nome', code: '1001' }, [s('9', 'Ana Paula Souza', '1001', 'B')]);
    expect(out.student?.id).toBe('9');
    expect(out.by).toBe('code');
  });
  it('não decide quando há homônimos', () => {
    const out = findGlobalMatch({ name: 'Ana Souza' }, [s('1', 'Ana Souza', null, 'B'), s('2', 'Ana Souza', null, 'C')]);
    expect(out.ambiguous).toBe(true);
    expect(out.student).toBeNull();
  });
});

describe('pickClassName', () => {
  it('prioriza o nome do banco sobre o nome antigo do card', () => {
    expect(pickClassName('NOVO-300', 'ANTIGO-300', 'ANTIGO-300')).toBe('NOVO-300');
    expect(pickClassName(null, 'SESSAO-300', 'CARD-300')).toBe('SESSAO-300');
    expect(pickClassName('  ', '', 'CARD-300')).toBe('CARD-300');
  });
});
