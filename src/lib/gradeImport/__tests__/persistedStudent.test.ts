import { describe, expect, it } from 'vitest';
import {
  assertPersistedStudent,
  recallPersistedStudent,
  rememberPersistedStudent,
  resolvePersistedStudentId,
  StudentScopeRow,
  studentIdentityKey,
  validateStudentScope,
} from '../persistedStudent';

const SCHOOL = 'school-A';
const OTHER_SCHOOL = 'school-B';
const CLASS = '26JMN-SEA-200';

const db: Record<string, StudentScopeRow> = {
  'stu-1': { id: 'stu-1', class: CLASS, school_id: SCHOOL },
  'stu-2': { id: 'stu-2', class: CLASS, school_id: SCHOOL },
  'stu-other-class': { id: 'stu-other-class', class: '26JMM-100', school_id: SCHOOL },
  'stu-other-school': { id: 'stu-other-school', class: CLASS, school_id: OTHER_SCHOOL },
};
const lookup = async (id: string) => db[id] ?? null;
const expected = { schoolId: SCHOOL, classNames: [CLASS] };

describe('resolvePersistedStudentId — o ID da UI é a fonte única', () => {
  it('A) prévia textual com match único: o ID pré-selecionado na UI é gravado', async () => {
    // A leitura local casou 100% e pré-selecionou stu-1 no campo da UI.
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: 'stu-1' }, expected, lookup);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.studentId).toBe('stu-1');
  });

  it('B) detected.student_id vazio mas ID selecionado válido: grava pelo ID selecionado', async () => {
    const detected = { student_id: null as string | null };
    const id = resolvePersistedStudentId({ pageAction: 'link', linkStudentId: 'stu-2' });
    expect(detected.student_id).toBeNull();
    expect(id).toBe('stu-2');
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: 'stu-2' }, expected, lookup);
    expect(check.ok).toBe(true);
  });

  it('C) ID de aluno de outra turma bloqueia a gravação', async () => {
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: 'stu-other-class' }, expected, lookup);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe('other_class');
      expect(check.message).toContain('26JMM-100');
    }
  });

  it('D) ID de aluno de outra escola bloqueia a gravação (isolamento multi-escola)', async () => {
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: 'stu-other-school' }, expected, lookup);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('other_school');
  });

  it('E) mesmo aluno nas páginas 1 e 3 grava no mesmo ID', async () => {
    const identity = { pdf_code: '2604040000', pdf_name: 'FRANCISCO DAS CHAGAS' };
    let memory = rememberPersistedStudent(new Map(), identity, 'stu-1');
    // Página 2: outro aluno — não interfere.
    memory = rememberPersistedStudent(memory, { pdf_code: '999', pdf_name: 'OUTRA PESSOA' }, 'stu-2');
    // Página 3: mesmo código, leitura sem match automático.
    const recalled = recallPersistedStudent(memory, { pdf_code: '2604040000', pdf_name: 'FRANCISCO D. CHAGAS' });
    expect(recalled).toBe('stu-1');
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: recalled }, expected, lookup);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.studentId).toBe('stu-1');
  });

  it('F) seleção manual substitui o match automático apenas naquela página', () => {
    const page1 = { pageAction: 'link' as const, linkStudentId: 'stu-2', detected: 'stu-1' };
    const page2 = { pageAction: 'link' as const, linkStudentId: 'stu-1', detected: 'stu-1' };
    expect(resolvePersistedStudentId(page1)).toBe('stu-2');
    expect(resolvePersistedStudentId(page2)).toBe('stu-1');
    // A memória entre páginas é por identidade do PDF: a escolha manual do aluno X
    // nunca "vaza" para uma página de outro aluno.
    const memory = rememberPersistedStudent(new Map(), { pdf_code: '111', pdf_name: 'ALUNO X' }, 'stu-2');
    expect(recallPersistedStudent(memory, { pdf_code: '222', pdf_name: 'ALUNO Y' })).toBeNull();
    expect(recallPersistedStudent(memory, { pdf_code: '111', pdf_name: 'ALUNO X' })).toBe('stu-2');
  });

  it('G) regressão: aluno inexistente continua bloqueado', async () => {
    const check = await assertPersistedStudent({ pageAction: 'link', linkStudentId: 'nao-existe' }, expected, lookup);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('not_found');
    const none = await assertPersistedStudent({ pageAction: 'link', linkStudentId: null }, expected, lookup);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.code).toBe('missing_selection');
  });

  it('ação "create" usa o ID recém-criado; "ignore" nunca grava', () => {
    expect(resolvePersistedStudentId({ pageAction: 'create', linkStudentId: 'stu-1', createdStudentId: 'novo' })).toBe('novo');
    expect(resolvePersistedStudentId({ pageAction: 'ignore', linkStudentId: 'stu-1' })).toBeNull();
    expect(resolvePersistedStudentId({ pageAction: 'link', linkStudentId: '   ' })).toBeNull();
  });

  it('aceita o nome efetivo OU o nome da propriedade da turma (turma renomeada pelo PDF)', () => {
    const row: StudentScopeRow = { id: 'stu-1', class: '26JMN-SEA-200 (fora)', school_id: SCHOOL };
    const ok = validateStudentScope(row, { studentId: 'stu-1', schoolId: SCHOOL, classNames: ['26JMN-SEA-200', '26JMN-SEA-200 (fora)'] });
    expect(ok.ok).toBe(true);
    const bad = validateStudentScope(row, { studentId: 'stu-1', schoolId: SCHOOL, classNames: ['26JMN-SEA-200'] });
    expect(bad.ok).toBe(false);
  });

  it('chave de identidade prioriza o código e cai para o nome normalizado', () => {
    expect(studentIdentityKey({ pdf_code: '0012.345', pdf_name: 'X' })).toBe('code:0012345');
    expect(studentIdentityKey({ pdf_code: null, pdf_name: '  José  da SILVA ' })).toBe('name:jose da silva');
    expect(studentIdentityKey({ pdf_code: null, pdf_name: '' })).toBeNull();
  });
});
