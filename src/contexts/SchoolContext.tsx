import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, type SchoolMembership } from '@/contexts/AuthContext';
import { pickActiveSchoolId } from '@/lib/schools/registration';

const STORAGE_KEY = 'edunexus.activeSchoolId';

interface SchoolContextType {
  /** Vínculos ativos do usuário */
  schools: SchoolMembership[];
  activeSchoolId: string | null;
  activeSchool: SchoolMembership | null;
  needsSchoolChoice: boolean;
  setActiveSchoolId: (schoolId: string) => void;
}

const SchoolContext = createContext<SchoolContextType>({
  schools: [],
  activeSchoolId: null,
  activeSchool: null,
  needsSchoolChoice: false,
  setActiveSchoolId: () => undefined,
});

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { memberships, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSchoolId, setActive] = useState<string | null>(null);

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.status === 'active'),
    [memberships],
  );

  useEffect(() => {
    if (!user) {
      setActive(null);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    const next = pickActiveSchoolId(activeMemberships, stored);
    setActive(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
  }, [user, activeMemberships]);

  const setActiveSchoolId = useCallback(
    (schoolId: string) => {
      if (schoolId === activeSchoolId) return;
      localStorage.setItem(STORAGE_KEY, schoolId);
      setActive(schoolId);
      // Troca de escola nunca deve exibir dados da escola anterior.
      queryClient.clear();
    },
    [activeSchoolId, queryClient],
  );

  const value = useMemo<SchoolContextType>(
    () => ({
      schools: activeMemberships,
      activeSchoolId,
      activeSchool: activeMemberships.find((m) => m.school_id === activeSchoolId) ?? null,
      needsSchoolChoice: activeMemberships.length > 1 && !activeSchoolId,
      setActiveSchoolId,
    }),
    [activeMemberships, activeSchoolId, setActiveSchoolId],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
};

export const useSchool = () => useContext(SchoolContext);
export const useActiveSchoolId = () => useContext(SchoolContext).activeSchoolId;
