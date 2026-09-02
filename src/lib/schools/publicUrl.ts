/**
 * Origem pública canônica do EDUNEXUS.
 * O link exclusivo de cadastro NUNCA pode apontar para o preview/editor do Lovable:
 * quem recebe o link não deve precisar de conta Lovable.
 */

/** Hosts que pertencem ao ambiente de preview/editor e não servem ao público. */
export const isPreviewHost = (host: string): boolean => {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true;
  if (h.startsWith('id-preview--')) return true;
  if (h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovable.dev' || h.endsWith('.lovable.dev')) return true;
  if (h.endsWith('.sandbox.lovable.dev')) return true;
  return false;
};

/** true quando a origin não pode ser usada como base pública de cadastro. */
export const isPreviewOrigin = (origin: string | null | undefined): boolean => {
  if (!origin) return true;
  try {
    return isPreviewHost(new URL(origin).host);
  } catch {
    return true;
  }
};

/** Normaliza a URL pública configurada: exige https:// e remove barra final. */
export const normalizePublicAppUrl = (input: string | null | undefined): string | null => {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (isPreviewHost(url.host)) return null;
  return `${url.protocol}//${url.host}`;
};

/**
 * Prioridade: (1) URL pública configurada; (2) origin atual se não for preview;
 * (3) null — sem base pública válida, o link não deve ser gerado.
 */
export const resolvePublicAppOrigin = (
  configuredUrl: string | null | undefined,
  currentOrigin: string | null | undefined,
): string | null =>
  normalizePublicAppUrl(configuredUrl) ??
  (isPreviewOrigin(currentOrigin) ? null : normalizePublicAppUrl(currentOrigin ?? ''));

export const PREVIEW_LINK_WARNING =
  'Você está no ambiente de preview do Lovable. Configure a URL pública do EDUNEXUS ' +
  '(ou abra a versão publicada) para copiar o link de cadastro.';
