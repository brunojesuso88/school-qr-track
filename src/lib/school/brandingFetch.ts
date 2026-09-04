/**
 * Identidade institucional da escola ATIVA para geradores de imagem/documento.
 *
 * Usa a RPC segura `get_school_branding` (SECURITY DEFINER, membro da escola)
 * e assina o caminho do logo no bucket privado de branding. Nunca há nome ou
 * logo fixo e nunca se lê branding de outra escola.
 */
import { supabase } from '@/integrations/supabase/client';
import { SCHOOL_BRANDING_BUCKET, unwrapSettingValue } from '@/lib/school/branding';

export interface SchoolBrandingSnapshot {
  schoolName: string;
  logoUrl: string | null;
}

export async function fetchSchoolBranding(
  schoolId: string | null | undefined,
): Promise<SchoolBrandingSnapshot> {
  if (!schoolId) return { schoolName: '', logoUrl: null };
  try {
    const { data, error } = await supabase.rpc('get_school_branding', { _school_id: schoolId });
    if (error) throw error;
    const row = (data ?? [])[0] as
      | { school_name: string | null; logo_path: string | null }
      | undefined;
    const schoolName = unwrapSettingValue(row?.school_name ?? '');
    const logoPath = unwrapSettingValue(row?.logo_path ?? '');
    let logoUrl: string | null = null;
    if (logoPath) {
      const { data: signed } = await supabase.storage
        .from(SCHOOL_BRANDING_BUCKET)
        .createSignedUrl(logoPath, 3600);
      logoUrl = signed?.signedUrl ?? null;
    }
    return { schoolName, logoUrl };
  } catch (err) {
    console.error('Não foi possível carregar a identidade da escola:', err);
    return { schoolName: '', logoUrl: null };
  }
}

/** Carrega a imagem do logo; devolve null se falhar (exportação nunca quebra). */
export async function loadImageSafe(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}
