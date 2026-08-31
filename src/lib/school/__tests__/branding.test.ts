import { describe, expect, it } from 'vitest';
import {
  SCHOOL_HERO_SETTING_KEY,
  SCHOOL_LOGO_SETTING_KEY,
  buildBrandingPath,
  unwrapSettingValue,
  validateBrandingImage,
} from '../branding';

describe('school branding helpers', () => {
  it('usa chaves distintas para hero e logo', () => {
    expect(SCHOOL_HERO_SETTING_KEY).toBe('school_hero_path');
    expect(SCHOOL_LOGO_SETTING_KEY).toBe('school_logo_path');
    expect(SCHOOL_LOGO_SETTING_KEY).not.toBe(SCHOOL_HERO_SETTING_KEY);
  });

  it('desembrulha valores jsonb', () => {
    expect(unwrapSettingValue('"branding/logo-1.png"')).toBe('branding/logo-1.png');
    expect(unwrapSettingValue('branding/logo-1.png')).toBe('branding/logo-1.png');
    expect(unwrapSettingValue(null)).toBe('');
    expect(unwrapSettingValue(undefined)).toBe('');
  });

  it('valida tipo e tamanho', () => {
    expect(validateBrandingImage({ type: 'image/png', size: 1000 })).toEqual({ ok: true });
    expect(validateBrandingImage({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(validateBrandingImage({ type: 'image/png', size: 6 * 1024 * 1024 }).ok).toBe(false);
  });

  it('gera caminhos separados por tipo', () => {
    expect(buildBrandingPath('logo', 'Minha Logo.PNG', 123)).toBe('branding/logo-123.png');
    expect(buildBrandingPath('hero', 'foto', 123)).toBe('branding/hero-123.jpg');
  });
});
