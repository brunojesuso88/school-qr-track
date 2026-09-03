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
 * Fonte de verdade institucional: RPC `get_school_branding` (SECURITY DEFINER),
 * que devolve apenas nome + hero + logo para membros da escola — professor
 * incluído — sem abrir leitura de `settings` sensíveis. URLs assinadas no
 * bucket privado de branding.
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
      if (!activeSchoolId) {
        setSchoolName('');
        setHeroPath('');
        setLogoPath('');
        setHeroUrl(null);
        setLogoUrl(null);
        return;
      }

      const { data, error } = await supabase.rpc('get_school_branding', {
        _school_id: activeSchoolId,
      });
      if (error) throw error;

      const row = (data ?? [])[0] as
        | { school_name: string | null; hero_path: string | null; logo_path: string | null }
        | undefined;

      const name = unwrapSettingValue(row?.school_name ?? '');
      const hero = unwrapSettingValue(row?.hero_path ?? '');
      const logo = unwrapSettingValue(row?.logo_path ?? '');

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
