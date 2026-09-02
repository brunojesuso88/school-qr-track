import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import {
  SCHOOL_BRANDING_BUCKET,
  SCHOOL_LOGO_SETTING_KEY,
  unwrapSettingValue,
} from '@/lib/school/branding';
import {
  SCHOOL_AUTHORITY_SETTING_KEY,
  SCHOOL_CITY_SETTING_KEY,
  SCHOOL_STATE_SETTING_KEY,
  type SchoolDocumentBranding,
  documentSchoolName,
  formatCityState,
} from '@/lib/school/documentBranding';

const toDataUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Identidade institucional da ESCOLA ATIVA para documentos e cabeçalhos.
 * Nome/cidade/UF vêm de `settings` (com fallback na tabela `schools`) e o brasão
 * do bucket privado de branding, já convertido em dataURL para PDF/impressão.
 */
export const useSchoolBranding = (): SchoolDocumentBranding & { refetch: () => Promise<void> } => {
  const activeSchoolId = useActiveSchoolId();
  const [state, setState] = useState<SchoolDocumentBranding>({
    schoolName: '',
    schoolNameUpper: '',
    city: '',
    state: '',
    cityStateLine: '',
    authority: '',
    logoUrl: null,
    logoDataUrl: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!activeSchoolId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const [{ data: settings }, { data: school }] = await Promise.all([
        supabase
          .from('settings')
          .select('key, value')
          .eq('school_id', activeSchoolId)
          .in('key', [
            'school_name',
            SCHOOL_LOGO_SETTING_KEY,
            SCHOOL_CITY_SETTING_KEY,
            SCHOOL_STATE_SETTING_KEY,
            SCHOOL_AUTHORITY_SETTING_KEY,
          ]),
        supabase
          .from('schools')
          .select('name, city, state, logo_path')
          .eq('id', activeSchoolId)
          .maybeSingle(),
      ]);

      const setting = (key: string) =>
        unwrapSettingValue(settings?.find((s) => s.key === key)?.value);

      const name = documentSchoolName(setting('school_name') || school?.name);
      const city = setting(SCHOOL_CITY_SETTING_KEY) || school?.city || '';
      const uf = setting(SCHOOL_STATE_SETTING_KEY) || school?.state || '';
      const authority = setting(SCHOOL_AUTHORITY_SETTING_KEY);
      const logoPath = setting(SCHOOL_LOGO_SETTING_KEY);

      let logoUrl: string | null = null;
      if (logoPath) {
        const { data: signed } = await supabase.storage
          .from(SCHOOL_BRANDING_BUCKET)
          .createSignedUrl(logoPath, 3600);
        logoUrl = signed?.signedUrl ?? null;
      }

      setState({
        schoolName: name,
        schoolNameUpper: name.toUpperCase(),
        city,
        state: uf,
        cityStateLine: formatCityState(city, uf),
        authority,
        logoUrl,
        logoDataUrl: await toDataUrl(logoUrl),
        loading: false,
      });
    } catch (err) {
      console.error('Erro ao carregar identidade da escola:', err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [activeSchoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refetch: load };
};
