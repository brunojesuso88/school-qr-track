import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import {
  defaultSchoolPreferences,
  parseSchoolPreferences,
  type SchoolPreferences,
} from '@/lib/settings/schoolPreferences';

/**
 * Preferências gerais da escola ativa.
 * Fonte: RPC `get_school_preferences` (SECURITY DEFINER, menor privilégio) —
 * devolve apenas chaves não sensíveis para membro ativo da escola, sem abrir
 * leitura genérica de `settings` para professor/funcionário.
 */
export const useSchoolPreferences = () => {
  const activeSchoolId = useActiveSchoolId();
  const [preferences, setPreferences] = useState<SchoolPreferences>(defaultSchoolPreferences);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSchoolId) {
      setPreferences(defaultSchoolPreferences());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_school_preferences', {
        _school_id: activeSchoolId,
      });
      if (error) throw error;
      setPreferences(parseSchoolPreferences(data));
    } catch (err) {
      console.error('Error loading school preferences:', err);
      setPreferences(defaultSchoolPreferences());
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    load();
  }, [load]);

  return { preferences, loading, refetch: load };
};
