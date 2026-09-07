/**
 * Helpers puros do cadastro multi-escola.
 * Não fazem I/O: toda validação real de token acontece no banco (RPC segura).
 */
import { normalizePublicAppUrl, resolvePublicAppOrigin } from './publicUrl';


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
  /** Id da escola do link (dado público: permite mostrar a situação REAL do vínculo da conta logada). */
  school_id?: string;
  school_name?: string;
  city?: string | null;
  state?: string | null;
  logo_path?: string | null;
  default_role?: AppRole;
  auto_approve?: boolean;
}

export const JOIN_ROUTE_PREFIX = '/join/';

/**
 * URL pública e exclusiva de cadastro de uma escola.
 * Retorna null quando a base não é pública (preview/editor do Lovable, localhost, http).
 */
export const buildJoinUrl = (token: string, origin: string | null | undefined): string | null => {
  const base = resolvePublicAppOrigin(null, origin) ?? normalizePublicAppUrl(origin);
  if (!base || !token) return null;
  return `${base}${JOIN_ROUTE_PREFIX}${token}`;
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

/** Situação do vínculo do usuário com UMA escola específica (`none` = nunca vinculado ou removido). */
export type SchoolMembershipState = 'none' | MembershipStatus;

export const membershipStateForSchool = (
  memberships: SchoolMembershipLike[],
  schoolId: string | null | undefined,
): SchoolMembershipState => {
  if (!schoolId) return 'none';
  const found = memberships.find((m) => m.school_id === schoolId);
  return found ? found.status : 'none';
};

/**
 * Situação geral de acesso de uma conta autenticada (para o guard de rotas):
 * - `active`: tem ao menos um vínculo ativo;
 * - `pending`: nenhum ativo, mas há solicitação aguardando aprovação;
 * - `closed`: só vínculos inativos/recusados (encerrados pela gestão);
 * - `none`: conta existente sem nenhum vínculo escolar (ex.: vínculo removido).
 */
export type AccountAccessState = 'active' | 'pending' | 'closed' | 'none';

export const describeAccountAccess = (memberships: SchoolMembershipLike[]): AccountAccessState => {
  if (memberships.some((m) => m.status === 'active')) return 'active';
  if (memberships.some((m) => m.status === 'pending')) return 'pending';
  if (memberships.length > 0) return 'closed';
  return 'none';
};

const JOIN_TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Extrai o token de cadastro a partir de um link completo (`https://app/join/<token>`)
 * ou do próprio token colado. Retorna null quando não reconhece nada seguro.
 */
export const extractJoinToken = (input: string | null | undefined): string | null => {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/\/join\/([A-Za-z0-9_-]{8,128})(?:[/?#]|$)/);
  if (match) return match[1];
  if (JOIN_TOKEN_SHAPE.test(raw)) return raw;
  return null;
};

/**
 * Detecta cadastro com e-mail JÁ existente no Auth, cobrindo os dois comportamentos
 * do provedor: erro explícito (`user_already_exists`) ou usuário "ofuscado" sem
 * identidades (quando a confirmação de e-mail está ativa).
 */
export const isExistingAccountSignUp = (
  error: { message?: string; code?: string } | null | undefined,
  user: { identities?: unknown[] | null } | null | undefined,
): boolean => {
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    return error.code === 'user_already_exists'
      || msg.includes('already registered')
      || msg.includes('already been registered')
      || msg.includes('already exists');
  }
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
};

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
