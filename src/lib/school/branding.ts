export const SCHOOL_BRANDING_BUCKET = 'school-events';
export const SCHOOL_HERO_SETTING_KEY = 'school_hero_path';
export const SCHOOL_LOGO_SETTING_KEY = 'school_logo_path';

export const MAX_BRANDING_IMAGE_SIZE = 5 * 1024 * 1024;

/** settings.value é jsonb: pode chegar como string com aspas extras. */
export const unwrapSettingValue = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/^"|"$/g, '');
  if (value == null) return '';
  return String(value);
};

export type BrandingValidation = { ok: boolean; error?: string };

export const validateBrandingImage = (file: { type: string; size: number }): BrandingValidation => {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Selecione um arquivo de imagem válido' };
  }
  if (file.size > MAX_BRANDING_IMAGE_SIZE) {
    return { ok: false, error: 'A imagem deve ter no máximo 5MB' };
  }
  return { ok: true };
};

/** Caminho estável e único por upload, isolado por tipo de branding. */
export const buildBrandingPath = (
  kind: 'hero' | 'logo',
  fileName: string,
  now: number = Date.now(),
): string => {
  const parts = fileName.split('.');
  const raw = parts.length > 1 ? parts.pop()! : '';
  const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `branding/${kind}-${now}.${ext}`;
};
