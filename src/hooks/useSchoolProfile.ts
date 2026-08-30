import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const SCHOOL_HERO_BUCKET = 'school-events';
export const SCHOOL_HERO_SETTING_KEY = 'school_hero_path';

const unwrap = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/^"|"$/g, '');
  if (value == null) return '';
  return String(value);
};

export interface SchoolProfile {
  schoolName: string;
  heroPath: string;
  heroUrl: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fonte de verdade institucional: tabela `settings`
 * (`school_name` + `school_hero_path`), com URL assinada do bucket privado.
 */
export const useSchoolProfile = (): SchoolProfile => {
  const [schoolName, setSchoolName] = useState('');
  const [heroPath, setHeroPath] = useState('');
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['school_name', SCHOOL_HERO_SETTING_KEY]);

      if (error) throw error;

      const name = unwrap(data?.find((s) => s.key === 'school_name')?.value);
      const path = unwrap(data?.find((s) => s.key === SCHOOL_HERO_SETTING_KEY)?.value);

      setSchoolName(name);
      setHeroPath(path);

      if (path) {
        const { data: signed } = await supabase.storage
          .from(SCHOOL_HERO_BUCKET)
          .createSignedUrl(path, 3600);
        setHeroUrl(signed?.signedUrl ?? null);
      } else {
        setHeroUrl(null);
      }
    } catch (err) {
      console.error('Error loading school profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { schoolName, heroPath, heroUrl, loading, refetch: load };
};
