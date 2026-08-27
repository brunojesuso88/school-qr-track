/**
 * Pesquisa de CID em camadas: formato -> catálogo local -> cache -> IA (fallback).
 * NUNCA envia dados do aluno para a IA. Apenas o código informado.
 */
import { supabase } from '@/integrations/supabase/client';

export type CidSource = 'catalog' | 'ai' | 'manual';

export interface CidLookupResult {
  code: string;
  description: string | null;
  simple_explanation: string | null;
  source: CidSource | null;
  status: 'ok' | 'unknown' | 'invalid';
}

/** Ex.: A09, J11, M54.5 — com ou sem ponto. */
export const CID_REGEX = /^[A-Z]\d{2}(\.?\d)?$/;

/** Normaliza para maiúsculo, sem espaços, com ponto antes da subcategoria. */
export function normalizeCid(raw: string): string {
  const cleaned = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 4)}`;
}

export function isValidCid(raw: string): boolean {
  return CID_REGEX.test(normalizeCid(raw));
}

/** Catálogo determinístico mínimo e extensível dos códigos mais frequentes em atestados escolares. */
export const CID_CATALOG: Record<string, string> = {
  A09: 'Diarreia e gastroenterite de origem infecciosa presumível',
  B34: 'Doença por vírus de localização não especificada',
  'J00': 'Nasofaringite aguda (resfriado comum)',
  J02: 'Faringite aguda',
  J03: 'Amigdalite aguda',
  J06: 'Infecção aguda das vias aéreas superiores de localização múltipla',
  J11: 'Influenza (gripe) devida a vírus não identificado',
  J18: 'Pneumonia por microorganismo não especificado',
  J45: 'Asma',
  'K29': 'Gastrite e duodenite',
  K52: 'Outras gastroenterites e colites não infecciosas',
  M54: 'Dorsalgia',
  'M54.5': 'Dor lombar baixa',
  N39: 'Outros transtornos do trato urinário',
  R05: 'Tosse',
  R10: 'Dor abdominal e pélvica',
  R42: 'Tontura e instabilidade',
  R50: 'Febre de origem desconhecida',
  R51: 'Cefaleia',
  S93: 'Luxação, entorse e distensão das articulações e dos ligamentos ao nível do tornozelo e do pé',
  U07: 'Uso emergencial (COVID-19)',
  Z76: 'Contato com serviços de saúde em outras circunstâncias',
};

export function lookupCatalog(raw: string): CidLookupResult | null {
  const code = normalizeCid(raw);
  const exact = CID_CATALOG[code];
  if (exact) {
    return { code, description: exact, simple_explanation: null, source: 'catalog', status: 'ok' };
  }
  const base = code.slice(0, 3);
  const parent = CID_CATALOG[base];
  if (parent) {
    return { code, description: parent, simple_explanation: null, source: 'catalog', status: 'ok' };
  }
  return null;
}

/**
 * Fluxo completo. Retorna `invalid` sem chamar IA quando o formato é inválido,
 * e nunca inventa descrição quando a IA responde `unknown`.
 */
export async function lookupCid(raw: string): Promise<CidLookupResult> {
  const code = normalizeCid(raw);
  if (!CID_REGEX.test(code)) {
    return { code, description: null, simple_explanation: null, source: null, status: 'invalid' };
  }

  const fromCatalog = lookupCatalog(code);
  if (fromCatalog) return fromCatalog;

  const { data: cached } = await supabase
    .from('cid_lookup_cache')
    .select('code, description, simple_explanation, source')
    .eq('code', code)
    .maybeSingle();

  if (cached?.description) {
    return {
      code,
      description: cached.description,
      simple_explanation: cached.simple_explanation,
      source: (cached.source as CidSource) ?? 'ai',
      status: 'ok',
    };
  }

  const { data, error } = await supabase.functions.invoke('cid-lookup', { body: { code } });
  if (error || !data || data.status !== 'ok' || !data.description) {
    return { code, description: null, simple_explanation: null, source: null, status: 'unknown' };
  }

  return {
    code,
    description: data.description as string,
    simple_explanation: (data.simple_explanation as string) ?? null,
    source: 'ai',
    status: 'ok',
  };
}

export const CID_DISCLAIMER = 'Descrição informativa do código. Não substitui avaliação médica.';
