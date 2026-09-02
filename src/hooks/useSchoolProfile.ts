import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import {
  SCHOOL_BRANDING_BUCKET,
  SCHOOL_HERO_SETTING_KEY,
  SCHOOL_LOGO_SETTING_KEY,
  unwrapSettingValue,
} from '@/lib/school/branding';

export const SCHOOL_HERO_BUCKET = SCHOOL_BRANDING_BUCKET;
export { SCHOOL_HERO_SETTING_KEY, SCHOOL_LOGO_SETTING_KEY };

export interface SchoolProfile {
  schoolName: string;
  heroPath: string;
  heroUrl: string | null;
  logoPath: string;
  logoUrl: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fonte de verdade institucional: tabela `settings`
 * (`school_name` + `school_hero_path` + `school_logo_path`),
 * com URL assinada do bucket privado.
 */
export const useSchoolProfile = (): SchoolProfile => {
  const [schoolName, setSchoolName] = useState('');
  const [heroPath, setHeroPath] = useState('');
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeSchoolId = useActiveSchoolId();

  const load = useCallback(async () => {
    try {
      let query = supabase
        .from('settings')
        .select('key, value')
        .in('key', ['school_name', SCHOOL_HERO_SETTING_KEY, SCHOOL_LOGO_SETTING_KEY]);

      if (activeSchoolId) query = query.eq('school_id', activeSchoolId);

      const { data, error } = await query;

      if (error) throw error;

      const name = unwrapSettingValue(data?.find((s) => s.key === 'school_name')?.value);
      const hero = unwrapSettingValue(data?.find((s) => s.key === SCHOOL_HERO_SETTING_KEY)?.value);
      const logo = unwrapSettingValue(data?.find((s) => s.key === SCHOOL_LOGO_SETTING_KEY)?.value);

      setSchoolName(name);
      setHeroPath(hero);
      setLogoPath(logo);

      const signedFor = async (path: string) => {
        if (!path) return null;
        const { data: signed } = await supabase.storage
          .from(SCHOOL_BRANDING_BUCKET)
          .createSignedUrl(path, 3600);
        return signed?.signedUrl ?? null;
      };

      setHeroUrl(await signedFor(hero));
      setLogoUrl(await signedFor(logo));
    } catch (err) {
      console.error('Error loading school profile:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    load();
  }, [load]);

  return { schoolName, heroPath, heroUrl, logoPath, logoUrl, loading, refetch: load };
};
