/**
 * Modelo puro (sem I/O) do ciclo de vida do vínculo usuário↔escola.
 *
 * Espelha as regras aplicadas no banco por `join_school_with_token` e
 * `admin_remove_membership`, para que a UI decida o que mostrar e para que os
 * cenários críticos (remover e recadastrar, conta existente sem vínculo,
 * vínculo em outra escola, não duplicar identidade/vínculo, isolamento por
 * escola) sejam testados de forma determinística.
 *
 * Identidade Auth é GLOBAL e única por e-mail; o vínculo (`school_memberships`)
 * é por escola, com unicidade `(school_id, user_id)`.
 */
import type { AppRole, MembershipStatus, SchoolMembershipLike } from './registration';

export interface MembershipRow extends SchoolMembershipLike {
  user_id: string;
}

export interface JoinInput {
  userId: string;
  schoolId: string;
  defaultRole: AppRole;
  /** `schools.auto_approve_registration` da escola do link. */
  autoApprove: boolean;
}

export interface JoinOutcome {
  ok: true;
  status: MembershipStatus;
  /** Já havia vínculo ativo/pendente — nada foi alterado. */
  already_member: boolean;
  /** Vínculo inativo/recusado foi reaberto como pendente. */
  reopened: boolean;
  requires_admin_approval: boolean;
  /** O usuário já é ativo em outra escola (segundo vínculo → sempre aprovação). */
  second_school: boolean;
}

/** Perfis privilegiados nunca entram por aceite automático. */
const PRIVILEGED: AppRole[] = ['admin', 'direction'];

/**
 * Aplica um cadastro por link sobre o conjunto de vínculos, devolvendo o novo
 * conjunto (imutável) e o resultado — mesma semântica da RPC do banco.
 */
export const applyJoin = (
  rows: MembershipRow[],
  input: JoinInput,
): { rows: MembershipRow[]; result: JoinOutcome } => {
  const otherActive = rows.some(
    (m) => m.user_id === input.userId && m.status === 'active' && m.school_id !== input.schoolId,
  );
  let auto = input.autoApprove;
  if (PRIVILEGED.includes(input.defaultRole)) auto = false;
  if (otherActive) auto = false;
  const target: MembershipStatus = auto ? 'active' : 'pending';

  const idx = rows.findIndex((m) => m.user_id === input.userId && m.school_id === input.schoolId);
  if (idx >= 0) {
    const existing = rows[idx];
    if (existing.status === 'inactive' || existing.status === 'rejected') {
      const next = rows.slice();
      next[idx] = { ...existing, status: 'pending', role: input.defaultRole };
      return {
        rows: next,
        result: {
          ok: true,
          status: 'pending',
          already_member: false,
          reopened: true,
          requires_admin_approval: true,
          second_school: otherActive,
        },
      };
    }
    return {
      rows,
      result: {
        ok: true,
        status: existing.status,
        already_member: true,
        reopened: false,
        requires_admin_approval: existing.status !== 'active',
        second_school: otherActive,
      },
    };
  }

  return {
    rows: [
      ...rows,
      { user_id: input.userId, school_id: input.schoolId, role: input.defaultRole, status: target },
    ],
    result: {
      ok: true,
      status: target,
      already_member: false,
      reopened: false,
      requires_admin_approval: target !== 'active',
      second_school: otherActive,
    },
  };
};

/** Remover vínculo de UMA escola: apaga só aquela linha; identidade e demais escolas ficam intactas. */
export const removeMembership = (
  rows: MembershipRow[],
  schoolId: string,
  userId: string,
): MembershipRow[] => rows.filter((m) => !(m.school_id === schoolId && m.user_id === userId));

/** Vínculo mínimo (a listagem administrativa devolve `status` como texto livre). */
export interface SchoolScopedLike {
  school_id: string;
  status: string;
}

/** Vínculos do usuário em escolas diferentes da informada (qualquer status). */
export const membershipsOutsideSchool = <T extends SchoolScopedLike>(
  memberships: T[],
  schoolId: string,
): T[] => memberships.filter((m) => m.school_id !== schoolId);

/**
 * Exclusão DEFINITIVA da conta (identidade Auth) a partir do contexto de uma escola
 * só é permitida quando não há vínculo em nenhuma outra escola. Devolve o motivo
 * do bloqueio ou null quando pode prosseguir.
 */
export const accountDeletionBlockReason = (
  memberships: SchoolScopedLike[],
  contextSchoolId: string | null,
): string | null => {
  if (!contextSchoolId) return null; // admin global fora de contexto escolar decide sozinho
  const others = membershipsOutsideSchool(memberships, contextSchoolId);
  if (others.length === 0) return null;
  return others.length === 1
    ? 'Este usuário tem vínculo com outra escola. Remova apenas o vínculo desta escola.'
    : `Este usuário tem vínculo com outras ${others.length} escolas. Remova apenas o vínculo desta escola.`;
};

/**
 * Decisão do formulário de cadastro por link quando o e-mail já possui conta:
 * nunca criar uma segunda identidade — reutilizar a existente.
 */
export type SignUpPlan = 'create_account' | 'reuse_existing_account' | 'request_membership';

export const planSignUp = (input: {
  hasSession: boolean;
  accountExists: boolean;
}): SignUpPlan => {
  if (input.hasSession) return 'request_membership';
  if (input.accountExists) return 'reuse_existing_account';
  return 'create_account';
};
