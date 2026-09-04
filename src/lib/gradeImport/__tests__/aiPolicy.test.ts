import { describe, expect, it } from 'vitest';
import { decideAiFallback, readingOriginLabel, readingUsedAi } from '../aiPolicy';

const conclusive = { ok: true, authoritative: true, preview: {}, validation: { reasons: [], score: 0.98 } };
const needsValidation = {
  ok: true, authoritative: false, preview: {},
  validation: { reasons: ['baixa_confianca'], score: 0.6 },
  reading: { blockers: ['low_confidence'] },
};
const failed = { ok: false, authoritative: false, preview: null, validation: { reasons: ['sem_grade'] } };

describe('decideAiFallback — política central de uso da IA', () => {
  it('leitura local conclusiva NÃO chama a IA no modo padrão', () => {
    const d = decideAiFallback(conclusive, { mode: 'local_ai', hasLocalDocument: true });
    expect(d.useAi).toBe(false);
    expect(d.reason).toBe('local_conclusive');
    expect(d.origin).toBe('local_conclusive');
  });

  it('leitura local com bloqueantes chama a IA como validação (origem local_validated)', () => {
    const d = decideAiFallback(needsValidation, { mode: 'local_ai', hasLocalDocument: true });
    expect(d.useAi).toBe(true);
    expect(d.reason).toBe('local_needs_validation');
    expect(d.origin).toBe('local_validated');
    expect(d.details).toEqual(['baixa_confianca', 'low_confidence']);
  });

  it('leitura local sem prévia utilizável cai para IA (fallback)', () => {
    const d = decideAiFallback(failed, { mode: 'local_ai', hasLocalDocument: true });
    expect(d).toMatchObject({ useAi: true, reason: 'local_not_ok', origin: 'ai_fallback' });
  });

  it('PDF que não abre localmente ou leitura local com exceção → IA fallback', () => {
    expect(decideAiFallback(null, { mode: 'local_ai', hasLocalDocument: false }).reason).toBe('no_local_document');
    expect(decideAiFallback(null, { mode: 'local_ai', hasLocalDocument: true, localError: true }).reason).toBe('local_failed');
  });

  it('modos explícitos do usuário: always_ai valida sempre; ai_only ignora o local', () => {
    const always = decideAiFallback(conclusive, { mode: 'always_ai', hasLocalDocument: true });
    expect(always).toMatchObject({ useAi: true, reason: 'always_ai_mode', origin: 'local_validated' });
    const only = decideAiFallback(conclusive, { mode: 'ai_only', hasLocalDocument: true });
    expect(only).toMatchObject({ useAi: true, reason: 'ai_only_mode', origin: 'ai_only' });
  });

  it('rótulos de origem exibidos ao usuário', () => {
    expect(readingOriginLabel({ mode: 'local', authority: 'authoritative' })).toBe('Leitura local — conclusiva');
    expect(readingOriginLabel({ mode: 'local', authority: 'needs_validation' })).toBe('Leitura local — requer conferência');
    expect(readingOriginLabel({ mode: 'local_validated' })).toBe('Leitura local — validada por IA');
    expect(readingOriginLabel({ mode: 'ai_fallback' })).toBe('IA usada como fallback');
    expect(readingUsedAi({ mode: 'local' })).toBe(false);
    expect(readingUsedAi({ mode: 'ai_fallback' })).toBe(true);
    expect(readingUsedAi({ mode: 'local', ai_used: true })).toBe(true);
  });
});
