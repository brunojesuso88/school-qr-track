import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  hasSchoolAccess as computeSchoolAccess,
  isAwaitingApproval,
  resolveEffectiveRole,
  type SchoolMembershipLike,
} from '@/lib/schools/registration';

type AppRole = 'admin' | 'direction' | 'teacher' | 'staff';

export interface SchoolMembership extends SchoolMembershipLike {
  school_name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole | null;
  memberships: SchoolMembership[];
  isGlobalAdmin: boolean;
  hasSchoolAccess: boolean;
  awaitingApproval: boolean;
  refreshAccess: () => Promise<void>;
  isAdmin: boolean;
  isDashboardUser: boolean;
  isStaffOnly: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canAccessFullDashboard: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AccessState {
  legacyRole: AppRole | null;
  globalAdmin: boolean;
  memberships: SchoolMembership[];
}

const EMPTY_ACCESS: AccessState = { legacyRole: null, globalAdmin: false, memberships: [] };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessState>(EMPTY_ACCESS);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchAccess = async (userId: string): Promise<AccessState> => {
    try {
      const [rolesRes, membershipsRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('school_memberships')
          .select('school_id, role, status, schools(name)')
          .eq('user_id', userId),
      ]);

      const legacyRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const memberships: SchoolMembership[] = (membershipsRes.data ?? []).map((m) => ({
        school_id: m.school_id as string,
        role: m.role as AppRole,
        status: m.status as SchoolMembership['status'],
        school_name:
          (m as unknown as { schools?: { name?: string } }).schools?.name ?? 'Escola',
      }));

      return {
        legacyRole: legacyRoles[0] ?? null,
        globalAdmin: legacyRoles.includes('admin'),
        memberships,
      };
    } catch (error) {
      console.error('Error fetching access:', error);
      return EMPTY_ACCESS;
    }
  };

  const refreshAccess = async () => {
    if (!user) return;
    setAccess(await fetchAccess(user.id));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchAccess(session.user.id).then((next) => {
          setAccess(next);
          setLoading(false);
          setInitialLoadDone(true);
        });
      } else {
        setLoading(false);
        setInitialLoadDone(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (initialLoadDone) setLoading(true);
          setTimeout(() => {
            fetchAccess(session.user.id).then((next) => {
              setAccess(next);
              setLoading(false);
            });
          }, 0);
        } else {
          setAccess(EMPTY_ACCESS);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccess(EMPTY_ACCESS);
  };

  const isGlobalAdmin = access.globalAdmin;
  const userRole = resolveEffectiveRole(isGlobalAdmin, access.memberships, access.legacyRole);
  const schoolAccess = computeSchoolAccess(isGlobalAdmin, access.memberships) ||
    // Compatibilidade: usuários legados sem membership ainda entram pelo user_roles.
    (access.memberships.length === 0 && access.legacyRole !== null);
  const awaitingApproval = isAwaitingApproval(access.memberships);

  // Acesso ao dashboard completo: admin, direção e professor com acesso escolar válido
  const canAccessFullDashboard =
    schoolAccess && (userRole === 'admin' || userRole === 'direction' || userRole === 'teacher');
  const isDashboardUser = canAccessFullDashboard;
  const isAdmin = schoolAccess && userRole !== null;
  const isStaffOnly = schoolAccess && userRole === 'staff';
  const canAccessSettings = schoolAccess && (userRole === 'admin' || userRole === 'direction');
  const canManageUsers = isGlobalAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userRole,
      memberships: access.memberships,
      isGlobalAdmin,
      hasSchoolAccess: schoolAccess,
      awaitingApproval,
      refreshAccess,
      isAdmin,
      isDashboardUser,
      isStaffOnly,
      canAccessSettings,
      canManageUsers,
      canAccessFullDashboard,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
