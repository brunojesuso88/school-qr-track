import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Nome completo do usuário autenticado, vindo de `profiles.full_name`. */
export const useUserFullName = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.id) {
        if (active) {
          setFullName('');
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (active) setFullName((data?.full_name ?? '').trim());
      } catch (err) {
        console.error('Error loading profile name:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  return { fullName, loading };
};
