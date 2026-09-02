import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePublicAppUrl, resolvePublicAppOrigin } from '@/lib/schools/publicUrl';

const KEY = 'public_app_url';

/** app_config é global (chave/valor); tipos gerados podem não conhecê-la ainda. */
const config = () =>
  (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { value: string | null } | null }> };
      };
      upsert: (row: Record<string, unknown>, opts: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  }).from('app_config');

/** URL pública canônica do EDUNEXUS (nunca o preview do Lovable). */
export const usePublicAppUrl = () => {
  const [configuredUrl, setConfiguredUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await config().select('value').eq('key', KEY).maybeSingle();
    setConfiguredUrl(normalizePublicAppUrl(data?.value ?? null));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (value: string) => {
    const normalized = normalizePublicAppUrl(value);
    if (!normalized) return { error: 'Informe uma URL pública válida iniciando com https://' };
    const { error } = await config().upsert(
      { key: KEY, value: normalized, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
    if (error) return { error: error.message };
    setConfiguredUrl(normalized);
    return { error: null };
  }, []);

  const currentOrigin = typeof window === 'undefined' ? null : window.location.origin;

  return {
    loading,
    configuredUrl,
    /** Base pública efetiva; null quando só existe o preview. */
    publicOrigin: resolvePublicAppOrigin(configuredUrl, currentOrigin),
    save,
    reload: load,
  };
};
