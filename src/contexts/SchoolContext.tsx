import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, type SchoolMembership } from '@/contexts/AuthContext';
import { schoolScopeKey } from '@/lib/schools/scope';
import { pickActiveSchoolId } from '@/lib/schools/registration';
import {
  getActiveSchoolIdSnapshot,
  setActiveSchoolIdStore,
  subscribeActiveSchoolId,
} from '@/lib/schools/activeSchoolStore';

interface SchoolContextType {
  /** Vínculos ativos do usuário */
  schools: SchoolMembership[];
  activeSchoolId: string | null;
  activeSchool: SchoolMembership | null;
  /** Papel efetivo NA escola ativa (admin global => 'admin'). */
  schoolRole: SchoolMembership['role'] | null;
  /** Gestão da escola ativa (admin/direção) — usar em canManage/canDelete. */
  canManageActiveSchool: boolean;
  needsSchoolChoice: boolean;
  /** Muda a cada troca de escola: use como dependência de useEffect/useState. */
  schoolScopeKey: string;
  setActiveSchoolId: (schoolId: string) => void;
}

const SchoolContext = createContext<SchoolContextType>({
  schools: [],
  activeSchoolId: null,
  activeSchool: null,
  schoolRole: null,
  canManageActiveSchool: false,
  needsSchoolChoice: false,
  schoolScopeKey: 'no-school',
  setActiveSchoolId: () => undefined,
});

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { memberships, user, isGlobalAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeSchoolId, setActiveState] = useState<string | null>(getActiveSchoolIdSnapshot());

  // Mantém contexto e store sincronizados (o store alimenta o AuthContext).
  useEffect(() => subscribeActiveSchoolId(() => setActiveState(getActiveSchoolIdSnapshot())), []);
  const setActive = useCallback((id: string | null) => setActiveSchoolIdStore(id), []);

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.status === 'active'),
    [memberships],
  );

  useEffect(() => {
    if (!user) {
      setActive(null);
      return;
    }
    const next = pickActiveSchoolId(activeMemberships, getActiveSchoolIdSnapshot());
    setActive(next);
  }, [user, activeMemberships, setActive]);

  const setActiveSchoolId = useCallback(
    (schoolId: string) => {
      if (schoolId === activeSchoolId) return;
      setActive(schoolId);
      // Troca de escola nunca deve exibir dados da escola anterior.
      queryClient.clear();
    },
    [activeSchoolId, queryClient, setActive],
  );

  const active = useMemo(
    () => activeMemberships.find((m) => m.school_id === activeSchoolId) ?? null,
    [activeMemberships, activeSchoolId],
  );
  const schoolRole = isGlobalAdmin ? 'admin' : (active?.role ?? null);

  const value = useMemo<SchoolContextType>(
    () => ({
      schools: activeMemberships,
      activeSchoolId,
      activeSchool: active,
      schoolRole,
      canManageActiveSchool: schoolRole === 'admin' || schoolRole === 'direction',
      needsSchoolChoice: activeMemberships.length > 1 && !activeSchoolId,
      schoolScopeKey: schoolScopeKey(activeSchoolId),
      setActiveSchoolId,
    }),
    [activeMemberships, activeSchoolId, active, schoolRole, setActiveSchoolId],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
};

export const useSchool = () => useContext(SchoolContext);
export const useActiveSchoolId = () => useContext(SchoolContext).activeSchoolId;
/** Papel efetivo na escola ativa. */
export const useSchoolRole = () => useContext(SchoolContext).schoolRole;
/** Chave que muda a cada troca de escola (dependência de useEffect). */
export const useSchoolScopeKey = () => useContext(SchoolContext).schoolScopeKey;
