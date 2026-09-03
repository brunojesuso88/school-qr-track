/**
 * Helpers puros de hierarquia de usuários (Configurações → Usuários e escolas).
 * Critério primário: nível do papel. Desempate: nome (fallback e-mail) A–Z.
 * Não altera permissões nem regras de acesso — apenas ordem de exibição.
 */

export type HierarchyRole = 'admin' | 'direction' | 'teacher' | 'staff';

const ROLE_RANKS: Record<string, number> = {
  admin: 1,
  direction: 2,
  teacher: 3,
  staff: 4,
};

/** Menor número = maior hierarquia. Global admin = 0; sem papel = 99. */
export function roleRank(role?: string | null, isGlobalAdmin = false): number {
  if (isGlobalAdmin) return 0;
  if (!role) return 99;
  return ROLE_RANKS[role] ?? 99;
}

export interface HierarchyMembership {
  role?: string | null;
  status?: string | null;
}

export interface HierarchyUser {
  full_name?: string | null;
  email?: string | null;
  is_global_admin?: boolean;
  memberships?: HierarchyMembership[];
}

/** Maior nível entre os vínculos do usuário (global admin sempre no topo). */
export function highestRoleRank(user: HierarchyUser): number {
  if (user.is_global_admin) return 0;
  const ranks = (user.memberships ?? []).map((m) => roleRank(m.role));
  return ranks.length ? Math.min(...ranks) : 99;
}

const displayName = (u: { full_name?: string | null; email?: string | null }) =>
  (u.full_name?.trim() || u.email?.trim() || '').toLocaleLowerCase('pt-BR');

const byDisplayName = (
  a: { full_name?: string | null; email?: string | null },
  b: { full_name?: string | null; email?: string | null },
) => displayName(a).localeCompare(displayName(b), 'pt-BR', { sensitivity: 'base' });

/** Ordena usuários do sistema por maior nível de vínculo, depois nome A–Z. */
export function sortUsersByRole<T extends HierarchyUser>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const diff = highestRoleRank(a) - highestRoleRank(b);
    return diff !== 0 ? diff : byDisplayName(a, b);
  });
}

export interface HierarchyMember {
  role?: string | null;
  full_name?: string | null;
  email?: string | null;
}

/** Ordena membros de uma escola: admin → direction → teacher → staff, depois nome. */
export function sortMembersByRole<T extends HierarchyMember>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const diff = roleRank(a.role) - roleRank(b.role);
    return diff !== 0 ? diff : byDisplayName(a, b);
  });
}
