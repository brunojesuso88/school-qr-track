import { describe, expect, it } from 'vitest';
import {
  isPreviewHost,
  isPreviewOrigin,
  normalizePublicAppUrl,
  resolvePublicAppOrigin,
} from '../publicUrl';
import { buildJoinUrl } from '../registration';

const PREVIEW = 'https://id-preview--f46fb428-3ca8-4c1a-81d0-557b6c9e0895.lovable.app';
const PUBLIC = 'https://edunexusbruno.tech';

describe('detecção de host de preview', () => {
  it('reconhece preview, editor e localhost', () => {
    expect(isPreviewHost('id-preview--abc.lovable.app')).toBe(true);
    expect(isPreviewHost('abc.lovableproject.com')).toBe(true);
    expect(isPreviewHost('lovable.dev')).toBe(true);
    expect(isPreviewHost('localhost:8080')).toBe(true);
    expect(isPreviewOrigin(PREVIEW)).toBe(true);
    expect(isPreviewOrigin(null)).toBe(true);
  });

  it('aceita a URL publicada e o domínio próprio', () => {
    expect(isPreviewHost('school-qr-track.lovable.app')).toBe(false);
    expect(isPreviewOrigin(PUBLIC)).toBe(false);
  });
});

describe('normalização da URL pública', () => {
  it('exige https e remove barra final/caminho', () => {
    expect(normalizePublicAppUrl('https://edunexusbruno.tech/')).toBe(PUBLIC);
    expect(normalizePublicAppUrl(' https://edunexusbruno.tech/join ')).toBe(PUBLIC);
    expect(normalizePublicAppUrl('http://edunexusbruno.tech')).toBeNull();
    expect(normalizePublicAppUrl('edunexusbruno.tech')).toBeNull();
    expect(normalizePublicAppUrl('')).toBeNull();
    expect(normalizePublicAppUrl(PREVIEW)).toBeNull();
  });
});

describe('resolução da origem pública', () => {
  it('prioriza a URL configurada', () => {
    expect(resolvePublicAppOrigin(PUBLIC, PREVIEW)).toBe(PUBLIC);
  });

  it('usa a origin atual quando ela é pública', () => {
    expect(resolvePublicAppOrigin(null, 'https://school-qr-track.lovable.app'))
      .toBe('https://school-qr-track.lovable.app');
  });

  it('cai na URL de produção publicada no preview/localhost', () => {
    expect(resolvePublicAppOrigin(null, PREVIEW)).toBe(DEFAULT_PUBLIC_APP_URL);
    expect(resolvePublicAppOrigin('', 'http://localhost:8080')).toBe(DEFAULT_PUBLIC_APP_URL);
  });
});

describe('buildJoinUrl nunca aponta para o preview', () => {
  it('usa a URL publicada quando a base é preview/localhost', () => {
    expect(buildJoinUrl('abc123', PREVIEW)).toBe(`${DEFAULT_PUBLIC_APP_URL}/join/abc123`);
    expect(buildJoinUrl('abc123', 'http://localhost:8080')).toBe(
      `${DEFAULT_PUBLIC_APP_URL}/join/abc123`,
    );
    expect(buildJoinUrl('', PUBLIC)).toBeNull();
  });

  it('gera o link na base pública', () => {
    expect(buildJoinUrl('abc123', PUBLIC)).toBe(`${PUBLIC}/join/abc123`);
    expect(buildJoinUrl('abc123', `${PUBLIC}/`)).toBe(`${PUBLIC}/join/abc123`);
  });
});
