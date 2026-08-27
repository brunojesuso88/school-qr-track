export interface PushPlatformInfo {
  isIOS: boolean;
  isStandalone: boolean;
  /** iOS/iPadOS aberto no navegador (não instalado) — push é impossível nesse caso. */
  requiresInstall: boolean;
  platformLabel: string;
}

/**
 * Detecta o cenário de push do dispositivo.
 * `standalone` deve vir de matchMedia('(display-mode: standalone)') ||
 * (navigator as any).standalone.
 */
export function detectPushPlatform(
  userAgent: string,
  standalone: boolean,
): PushPlatformInfo {
  const ua = (userAgent || '').toLowerCase();
  const isIPadOS = ua.includes('macintosh') && ua.includes('mobile');
  const isIOS = /iphone|ipad|ipod/.test(ua) || isIPadOS;
  const isAndroid = ua.includes('android');

  let platformLabel = 'Desktop';
  if (isIOS) platformLabel = 'iOS/iPadOS';
  else if (isAndroid) platformLabel = 'Android';

  return {
    isIOS,
    isStandalone: standalone,
    requiresInstall: isIOS && !standalone,
    platformLabel,
  };
}

export function readStandaloneFlag(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}
