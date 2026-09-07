import { describe, expect, it } from 'vitest';
import {
  accountDeletionBlockReason,
  applyJoin,
  membershipsOutsideSchool,
  planSignUp,
  removeMembership,
  type MembershipRow,
} from '../membershipFlow';
import {
  describeAccountAccess,
  extractJoinToken,
  isExistingAccountSignUp,
  membershipStateForSchool,
} from '../registration';

const A = 'school-a';
const B = 'school-b';
const U = 'user-1';

const join = (rows: MembershipRow[], schoolId: string, autoApprove = true) =>
  applyJoin(rows, { userId: U, schoolId, defaultRole: 'teacher', autoApprove });

describe('ciclo remover vínculo → recadastrar (mesma identidade)', () => {
  it('remover vínculo apaga só a linha da escola; a identidade continua e pode voltar', () => {
    const first = join([], A, true);
    expect(first.result.status).toBe('active');
    expect(first.rows).toHaveLength(1);

    const afterRemove = removeMembership(first.rows, A, U);
    expect(afterRemove).toHaveLength(0); // sem vínculo, sem apagar Auth (não modelado aqui = intacto)

    const again = join(afterRemove, A, true);
    expect(again.result).toMatchObject({ ok: true, status: 'active', already_member: false, reopened: false });
    expect(again.rows).toHaveLength(1);
    expect(again.rows[0]).toMatchObject({ user_id: U, school_id: A, status: 'active' });
  });

  it('vínculo desativado é REABERTO como pendente (nunca duplica (school_id, user_id), nunca auto-aprova)', () => {
    const rows: MembershipRow[] = [{ user_id: U, school_id: A, role: 'teacher', status: 'inactive' }];
    const { rows: next, result } = join(rows, A, true);
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe('pending');
    expect(result).toMatchObject({ reopened: true, status: 'pending', requires_admin_approval: true, already_member: false });
  });

  it('vínculo recusado também reabre como pendente', () => {
    const rows: MembershipRow[] = [{ user_id: U, school_id: A, role: 'teacher', status: 'rejected' }];
    const { result } = join(rows, A, true);
    expect(result.reopened).toBe(true);
    expect(result.status).toBe('pending');
  });

  it('vínculo ativo ou pendente permanece como está (already_member)', () => {
    const active: MembershipRow[] = [{ user_id: U, school_id: A, role: 'teacher', status: 'active' }];
    expect(join(active, A).result).toMatchObject({ already_member: true, status: 'active', reopened: false });
    const pending: MembershipRow[] = [{ user_id: U, school_id: A, role: 'teacher', status: 'pending' }];
    expect(join(pending, A).result).toMatchObject({ already_member: true, status: 'pending', requires_admin_approval: true });
  });

  it('remover vínculo da escola A preserva o vínculo em B', () => {
    const rows: MembershipRow[] = [
      { user_id: U, school_id: A, role: 'teacher', status: 'active' },
      { user_id: U, school_id: B, role: 'teacher', status: 'active' },
    ];
    const next = removeMembership(rows, A, U);
    expect(next).toEqual([{ user_id: U, school_id: B, role: 'teacher', status: 'active' }]);
  });

  it('vínculo ativo em B + novo pedido em A → pending com second_school, sem alterar B', () => {
    const rows: MembershipRow[] = [{ user_id: U, school_id: B, role: 'direction', status: 'active' }];
    const { rows: next, result } = join(rows, A, true);
    expect(result).toMatchObject({
      status: 'pending', second_school: true, requires_admin_approval: true, already_member: false, reopened: false,
    });
    // B permanece exatamente como estava (papel e status) e A entra como pendente.
    expect(next.find((m) => m.school_id === B)).toEqual(rows[0]);
    expect(next.find((m) => m.school_id === A)).toMatchObject({ user_id: U, role: 'teacher', status: 'pending' });
    // Nunca duplica (school_id, user_id).
    const keys = next.map((m) => `${m.school_id}|${m.user_id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(next).toHaveLength(2);
  });

  it('vínculo ativo em B + vínculo encerrado em A → reabre A como pendente, B intacto', () => {
    const rows: MembershipRow[] = [
      { user_id: U, school_id: A, role: 'teacher', status: 'inactive' },
      { user_id: U, school_id: B, role: 'teacher', status: 'active' },
    ];
    const { rows: next, result } = join(rows, A, true);
    expect(result).toMatchObject({ status: 'pending', reopened: true, second_school: true });
    expect(next).toHaveLength(2);
    expect(next.find((m) => m.school_id === B)).toEqual(rows[1]);
    expect(next.find((m) => m.school_id === A)!.status).toBe('pending');
  });

  it('perfis privilegiados nunca são aprovados automaticamente', () => {
    const { result } = applyJoin([], { userId: U, schoolId: A, defaultRole: 'direction', autoApprove: true });
    expect(result.status).toBe('pending');
  });

  it('isolamento: outro usuário na mesma escola não interfere', () => {
    const rows: MembershipRow[] = [{ user_id: 'user-2', school_id: A, role: 'teacher', status: 'inactive' }];
    const { rows: next, result } = join(rows, A, true);
    expect(result).toMatchObject({ status: 'active', reopened: false });
    expect(next).toHaveLength(2);
    expect(next[0].status).toBe('inactive'); // linha do outro usuário intacta
  });
});

describe('estado do vínculo para a tela /join e para o guard', () => {
  it('membershipStateForSchool distingue none / pending / active / inactive / rejected', () => {
    const ms = [
      { school_id: A, role: 'teacher' as const, status: 'inactive' as const },
      { school_id: B, role: 'teacher' as const, status: 'active' as const },
    ];
    expect(membershipStateForSchool(ms, A)).toBe('inactive');
    expect(membershipStateForSchool(ms, B)).toBe('active');
    expect(membershipStateForSchool(ms, 'school-c')).toBe('none');
    expect(membershipStateForSchool(ms, null)).toBe('none');
  });

  it('describeAccountAccess: ativo > pendente > encerrado > sem vínculo', () => {
    expect(describeAccountAccess([])).toBe('none');
    expect(describeAccountAccess([{ school_id: A, role: 'teacher', status: 'inactive' }])).toBe('closed');
    expect(describeAccountAccess([{ school_id: A, role: 'teacher', status: 'rejected' }])).toBe('closed');
    expect(describeAccountAccess([
      { school_id: A, role: 'teacher', status: 'inactive' },
      { school_id: B, role: 'teacher', status: 'pending' },
    ])).toBe('pending');
    expect(describeAccountAccess([
      { school_id: A, role: 'teacher', status: 'pending' },
      { school_id: B, role: 'teacher', status: 'active' },
    ])).toBe('active');
  });
});

describe('cadastro por link com e-mail já existente', () => {
  it('planSignUp: sessão ativa solicita vínculo; conta existente reutiliza; senão cria', () => {
    expect(planSignUp({ hasSession: true, accountExists: false })).toBe('request_membership');
    expect(planSignUp({ hasSession: true, accountExists: true })).toBe('request_membership');
    expect(planSignUp({ hasSession: false, accountExists: true })).toBe('reuse_existing_account');
    expect(planSignUp({ hasSession: false, accountExists: false })).toBe('create_account');
  });

  it('isExistingAccountSignUp cobre erro explícito e usuário ofuscado sem identidades', () => {
    expect(isExistingAccountSignUp({ code: 'user_already_exists', message: 'x' }, null)).toBe(true);
    expect(isExistingAccountSignUp({ message: 'User already registered' }, null)).toBe(true);
    expect(isExistingAccountSignUp(null, { identities: [] })).toBe(true);
    expect(isExistingAccountSignUp(null, { identities: [{ id: '1' }] })).toBe(false);
    expect(isExistingAccountSignUp({ message: 'Password should be at least 6 characters' }, null)).toBe(false);
    expect(isExistingAccountSignUp(null, null)).toBe(false);
  });

  it('extractJoinToken aceita link completo, token cru e rejeita lixo', () => {
    expect(extractJoinToken('https://edunexusbruno.tech/join/abcDEF123_-xyz')).toBe('abcDEF123_-xyz');
    expect(extractJoinToken('https://app/join/abcDEF123_-xyz?utm=1')).toBe('abcDEF123_-xyz');
    expect(extractJoinToken('  abcDEF123_-xyz  ')).toBe('abcDEF123_-xyz');
    expect(extractJoinToken('short')).toBeNull();
    expect(extractJoinToken('https://app/auth')).toBeNull();
    expect(extractJoinToken('')).toBeNull();
    expect(extractJoinToken(null)).toBeNull();
  });
});

describe('exclusão definitiva no contexto de escola', () => {
  it('bloqueia quando há vínculo em outra escola; libera quando só há a escola atual', () => {
    const ms = [
      { school_id: A, role: 'teacher' as const, status: 'active' as const },
      { school_id: B, role: 'teacher' as const, status: 'inactive' as const },
    ];
    expect(accountDeletionBlockReason(ms, A)).toMatch(/outra escola/);
    expect(accountDeletionBlockReason(ms.slice(0, 1), A)).toBeNull();
    expect(accountDeletionBlockReason(ms, null)).toBeNull(); // admin global fora de contexto
    expect(membershipsOutsideSchool(ms, A)).toHaveLength(1);
  });

  it('conta com vínculos em 3 escolas informa a contagem', () => {
    const ms = [A, B, 'school-c'].map((id) => ({ school_id: id, role: 'teacher' as const, status: 'active' as const }));
    expect(accountDeletionBlockReason(ms, A)).toMatch(/outras 2 escolas/);
  });
});
