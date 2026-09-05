import { describe, expect, it } from 'vitest';
import { rebindDetectedStudent } from '../studentRebind';
import {
  inspectPersistedStudentRecall, recallPersistedStudent, rememberPersistedStudent,
  type PersistedStudentMemory,
} from '../persistedStudent';
import { applyResolvedStudentToDetected, applyResolvedStudentToRows } from '../registrationResolution';

const student = (id: string, full_name: string, school_code: string | null = null) =>
  ({ id, full_name, school_code });

const detected = (over: Record<string, unknown> = {}) => ({
  student_id: null as string | null,
  matched_name: null as string | null,
  status: 'unmatched',
  conflicts: ['not_in_class', 'unmatched_student'],
  pdf_name: 'MARIA DA SILVA SOUZA',
  pdf_code: '26.123.456',
  ...over,
});

const emptyMemory: PersistedStudentMemory = new Map();

describe('rebind multipágina do mesmo aluno', () => {
  it('A. prévia pré-lida como unmatched é rebindada quando o aluno já existe no contexto', () => {
    const d = detected();
    // No momento da pré-leitura a turma não tinha o aluno.
    expect(rebindDetectedStudent({ detected: d, students: [], memory: emptyMemory })).toBeNull();
    // A página 1 cadastrou o aluno: contexto atualizado.
    const students = [student('s1', 'MARIA DA SILVA SOUZA', '26123456')];
    const rebound = rebindDetectedStudent({ detected: d, students, memory: emptyMemory });
    expect(rebound).toMatchObject({ studentId: 's1', source: 'match' });

    const nextDetected = applyResolvedStudentToDetected(d, {
      studentId: rebound!.studentId, fullName: rebound!.fullName,
    });
    expect(nextDetected.student_id).toBe('s1');
    expect(nextDetected.status).toBe('matched');
    expect(nextDetected.conflicts).toEqual([]);

    const rows = applyResolvedStudentToRows(
      [{ flags: ['unmatched_student'], student_id: null, matched_name: null }],
      { studentId: 's1', fullName: 'MARIA DA SILVA SOUZA' },
    );
    expect(rows[0]).toMatchObject({ student_id: 's1', matched_name: 'MARIA DA SILVA SOUZA', flags: [] });
  });

  it('B. página 1 com código+nome, página 2 somente com nome: recall funciona', () => {
    const memory = rememberPersistedStudent(emptyMemory, detected(), 's1');
    const page2 = detected({ pdf_code: null });
    expect(recallPersistedStudent(memory, page2)).toBe('s1');
    const rebound = rebindDetectedStudent({
      detected: page2,
      students: [student('s1', 'MARIA DA SILVA SOUZA')],
      memory,
    });
    expect(rebound).toMatchObject({ studentId: 's1', source: 'memory' });
  });

  it('C. página 1 sem código, página 2 com código: match/rebind resolve', () => {
    const memory = rememberPersistedStudent(emptyMemory, detected({ pdf_code: null }), 's1');
    const page2 = detected({ pdf_code: '26.123.456' });
    // O código não está na memória, mas o nome está.
    expect(recallPersistedStudent(memory, page2)).toBe('s1');
    const rebound = rebindDetectedStudent({
      detected: page2,
      students: [student('s1', 'MARIA DA SILVA SOUZA', '26123456')],
      memory,
    });
    expect(rebound?.studentId).toBe('s1');
  });

  it('D. chaves de memória conflitantes bloqueiam até o fallback por match', () => {
    let memory = rememberPersistedStudent(emptyMemory, detected({ pdf_name: null }), 's1');
    memory = rememberPersistedStudent(memory, detected({ pdf_code: null }), 's2');
    const page = detected();
    expect(recallPersistedStudent(memory, page)).toBeNull();
    expect(inspectPersistedStudentRecall(memory, page)).toEqual({ status: 'conflict', studentId: null });
    // A turma teria um match SEGURO por código + nome, mas o conflito de memória
    // impede qualquer vínculo automático.
    const students = [student('s1', 'MARIA DA SILVA SOUZA', '26123456')];
    expect(rebindDetectedStudent({ detected: page, students, memory })).toBeNull();
  });

  it('conflitos manuais do cabeçalho nunca são rebindados', () => {
    const students = [student('s1', 'MARIA DA SILVA SOUZA', '26123456')];
    const memory = rememberPersistedStudent(emptyMemory, detected(), 's1');
    for (const conflict of ['ambiguous_match', 'duplicate_link']) {
      const page = detected({ conflicts: ['not_in_class', conflict] });
      expect(rebindDetectedStudent({ detected: page, students, memory })).toBeNull();
    }
  });

  it('E. flags acadêmicas sobrevivem ao rebind', () => {
    const rows = applyResolvedStudentToRows(
      [
        { flags: ['unmatched_student', 'invalid_value'], student_id: null, matched_name: null },
        { flags: ['out_of_scale', 'local_ai_divergence', 'existing_grade_conflict'], student_id: null, matched_name: null },
      ],
      { studentId: 's1', fullName: 'MARIA DA SILVA SOUZA' },
    );
    expect(rows[0].flags).toEqual(['invalid_value']);
    expect(rows[1].flags).toEqual(['out_of_scale', 'local_ai_divergence', 'existing_grade_conflict']);
    expect(rows.every((r) => r.student_id === 's1')).toBe(true);
  });

  it('F. aluno já existente nunca é recriado no cenário multipágina', () => {
    const memory = rememberPersistedStudent(emptyMemory, detected(), 's1');
    const students = [student('s1', 'MARIA DA SILVA SOUZA', '26123456')];
    const rebound = rebindDetectedStudent({ detected: detected(), students, memory });
    expect(rebound?.studentId).toBe('s1');
    // Como já existe seleção, um novo rebind (create) não é considerado.
    expect(rebindDetectedStudent({
      detected: detected({ student_id: 's1' }), students, memory,
    })).toBeNull();
  });

  it('homônimos continuam manuais (ambiguous nunca é auto-vinculado)', () => {
    const students = [
      student('s1', 'MARIA DA SILVA SOUZA'),
      student('s2', 'MARIA DA SILVA SOUZA'),
    ];
    expect(rebindDetectedStudent({ detected: detected({ pdf_code: null }), students, memory: emptyMemory })).toBeNull();
  });
});
