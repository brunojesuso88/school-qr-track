import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  resolvePermissions,
  type PermissionKey,
} from '@/lib/permissions/catalog';

interface PermissionsContextType {
  /** true quando o usuário pode executar a ação na escola ativa. */
  can: (key: PermissionKey) => boolean;
  /** Papel efetivo usado na resolução das permissões. */
  role: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  can: () => false,
  role: null,
  loading: true,
  refresh: async () => undefined,
});

interface RpcResult {
  role: string | null;
  permissions: Record<string, boolean> | null;
}

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGlobalAdmin, loading: authLoading } = useAuth();
  const { activeSchoolId, schoolRole } = useSchool();

  const enabled = !!user && !authLoading && (!!activeSchoolId || isGlobalAdmin);

  const { data, isLoading, refetch } = useQuery({
    // A chave inclui usuário + escola: trocar de escola recarrega as permissões.
    queryKey: ['school-permissions', user?.id ?? 'anon', activeSchoolId ?? 'none'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RpcResult> => {
      const { data, error } = await supabase.rpc('my_school_permissions', {
        _school_id: activeSchoolId,
      });
      if (error) throw error;
      return (data ?? { role: null, permissions: {} }) as unknown as RpcResult;
    },
  });

  const effectiveRole = isGlobalAdmin ? 'admin' : (data?.role ?? schoolRole ?? null);

  const permissions = useMemo(
    () => resolvePermissions(effectiveRole, data?.permissions),
    [effectiveRole, data?.permissions],
  );

  const can = useCallback(
    (key: PermissionKey) => {
      if (isGlobalAdmin || effectiveRole === 'admin') return true;
      return permissions[key] === true;
    },
    [isGlobalAdmin, effectiveRole, permissions],
  );

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo<PermissionsContextType>(
    () => ({ can, role: effectiveRole, loading: enabled ? isLoading : false, refresh }),
    [can, effectiveRole, enabled, isLoading, refresh],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => useContext(PermissionsContext);
/** Atalho: `useCan()('students.delete')`. */
export const useCan = () => useContext(PermissionsContext).can;
