/**
 * Helpers puros do cadastro multi-escola.
 * Não fazem I/O: toda validação real de token acontece no banco (RPC segura).
 */

export type AppRole = 'admin' | 'direction' | 'teacher' | 'staff';
export type MembershipStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export interface SchoolMembershipLike {
  school_id: string;
  role: AppRole;
  status: MembershipStatus;
}

export interface ResolvedRegistrationLink {
  valid: boolean;
  reason?: 'not_found' | 'revoked' | 'expired' | 'exhausted' | 'school_inactive';
  school_name?: string;
  city?: string | null;
  state?: string | null;
  logo_path?: string | null;
  default_role?: AppRole;
  auto_approve?: boolean;
}

export const JOIN_ROUTE_PREFIX = '/join/';

/** URL pública e exclusiva de cadastro de uma escola. */
export const buildJoinUrl = (token: string, origin: string): string => {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}${JOIN_ROUTE_PREFIX}${token}`;
};

export const slugifySchoolName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const registrationLinkErrorMessage = (
  reason: ResolvedRegistrationLink['reason'],
): string => {
  switch (reason) {
    case 'expired':
      return 'Este link de cadastro expirou. Solicite um novo link à escola.';
    case 'revoked':
      return 'Este link de cadastro foi revogado. Solicite um novo link à escola.';
    case 'exhausted':
      return 'Este link de cadastro atingiu o limite de usos.';
    case 'school_inactive':
      return 'Esta escola está inativa no momento.';
    default:
      return 'Link inválido ou expirado.';
  }
};

/** Papel efetivo do usuário: admin global sempre vence; senão o vínculo ativo. */
export const resolveEffectiveRole = (
  isGlobalAdmin: boolean,
  memberships: SchoolMembershipLike[],
  legacyRole: AppRole | null,
  activeSchoolId?: string | null,
): AppRole | null => {
  if (isGlobalAdmin) return 'admin';
  const actives = memberships.filter((m) => m.status === 'active');
  if (activeSchoolId) {
    const scoped = actives.find((m) => m.school_id === activeSchoolId);
    if (scoped) return scoped.role;
    // Escola ativa sem vínculo: só resolve papel se houver exatamente um vínculo.
    if (actives.length === 1) return actives[0].role;
    if (actives.length > 1) return null;
  }
  if (actives.length > 0) return actives[0].role;
  return actives.length === 0 && memberships.length > 0 ? null : legacyRole;
};

export const hasSchoolAccess = (
  isGlobalAdmin: boolean,
  memberships: SchoolMembershipLike[],
): boolean => isGlobalAdmin || memberships.some((m) => m.status === 'active');

export const isAwaitingApproval = (memberships: SchoolMembershipLike[]): boolean =>
  memberships.length > 0 &&
  !memberships.some((m) => m.status === 'active') &&
  memberships.some((m) => m.status === 'pending');

/** Caminho school-scoped para novos uploads (branding, atestados, eventos...). */
export const schoolStoragePath = (
  schoolId: string,
  folder: string,
  fileName: string,
): string => `schools/${schoolId}/${folder.replace(/^\/+|\/+$/g, '')}/${fileName}`;

/** Escolhe a escola ativa: preferência salva só vale se ainda houver vínculo ativo. */
export const pickActiveSchoolId = (
  memberships: SchoolMembershipLike[],
  storedId: string | null,
): string | null => {
  const actives = memberships.filter((m) => m.status === 'active');
  if (actives.length === 0) return null;
  if (storedId && actives.some((m) => m.school_id === storedId)) return storedId;
  return actives[0].school_id;
};
