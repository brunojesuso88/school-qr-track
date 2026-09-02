import { describe, expect, it } from 'vitest';
import {
  buildJoinUrl,
  hasSchoolAccess,
  isAwaitingApproval,
  pickActiveSchoolId,
  registrationLinkErrorMessage,
  resolveEffectiveRole,
  schoolStoragePath,
  slugifySchoolName,
  type SchoolMembershipLike,
} from '../registration';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

const m = (
  school_id: string,
  role: SchoolMembershipLike['role'],
  status: SchoolMembershipLike['status'],
): SchoolMembershipLike => ({ school_id, role, status });

describe('link exclusivo de cadastro', () => {
  it('monta a URL /join/:token', () => {
    expect(buildJoinUrl('abc123', 'https://app.edu')).toBe('https://app.edu/join/abc123');
    expect(buildJoinUrl('abc123', 'https://app.edu/')).toBe('https://app.edu/join/abc123');
  });

  it('mensagens específicas para token inválido/revogado/expirado', () => {
    expect(registrationLinkErrorMessage('expired')).toMatch(/expirou/);
    expect(registrationLinkErrorMessage('revoked')).toMatch(/revogado/);
    expect(registrationLinkErrorMessage('exhausted')).toMatch(/limite/);
    expect(registrationLinkErrorMessage('not_found')).toMatch(/inválido/);
  });

  it('gera slug estável a partir do nome', () => {
    expect(slugifySchoolName('Centro de Ensino Professor Antônio Nonato Sampaio')).toBe(
      'centro-de-ensino-professor-antonio-nonato-sampaio',
    );
    expect(slugifySchoolName('  Escola   São José!! ')).toBe('escola-sao-jose');
  });
});

describe('papel efetivo e acesso', () => {
  it('admin global sempre é admin', () => {
    expect(resolveEffectiveRole(true, [], null)).toBe('admin');
  });

  it('usa o papel do vínculo da escola ativa', () => {
    const list = [m(A, 'teacher', 'active'), m(B, 'direction', 'active')];
    expect(resolveEffectiveRole(false, list, null, B)).toBe('direction');
    expect(resolveEffectiveRole(false, list, null, A)).toBe('teacher');
  });

  it('sem vínculo ativo não há papel nem acesso', () => {
    const list = [m(A, 'teacher', 'pending')];
    expect(resolveEffectiveRole(false, list, null)).toBeNull();
    expect(hasSchoolAccess(false, list)).toBe(false);
    expect(isAwaitingApproval(list)).toBe(true);
  });

  it('vínculo recusado não vira pendente', () => {
    expect(isAwaitingApproval([m(A, 'teacher', 'rejected')])).toBe(false);
  });

  it('cai no papel legado quando não há memberships', () => {
    expect(resolveEffectiveRole(false, [], 'teacher')).toBe('teacher');
  });

  it('admin global tem acesso mesmo sem vínculo', () => {
    expect(hasSchoolAccess(true, [])).toBe(true);
  });
});

describe('escola ativa', () => {
  it('seleciona automaticamente quando há uma só', () => {
    expect(pickActiveSchoolId([m(A, 'teacher', 'active')], null)).toBe(A);
  });

  it('respeita a preferência salva quando ainda válida', () => {
    const list = [m(A, 'teacher', 'active'), m(B, 'teacher', 'active')];
    expect(pickActiveSchoolId(list, B)).toBe(B);
  });

  it('ignora preferência salva de escola sem vínculo ativo', () => {
    const list = [m(A, 'teacher', 'active'), m(B, 'teacher', 'inactive')];
    expect(pickActiveSchoolId(list, B)).toBe(A);
  });

  it('retorna null sem vínculos ativos', () => {
    expect(pickActiveSchoolId([m(A, 'teacher', 'pending')], A)).toBeNull();
  });
});

describe('storage school-scoped', () => {
  it('monta caminho por escola', () => {
    expect(schoolStoragePath(A, 'branding', 'logo.png')).toBe(`schools/${A}/branding/logo.png`);
    expect(schoolStoragePath(A, '/eventos/', 'capa.jpg')).toBe(`schools/${A}/eventos/capa.jpg`);
  });
});
