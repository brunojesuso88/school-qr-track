import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CID_REGEX = /^[A-Z]\d{2}(\.?\d)?$/;

function normalize(raw: unknown): string {
  const cleaned = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 4)}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Somente admin/direção podem consultar códigos CID.
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction']);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const code = normalize(body?.code);

    // Validação determinística ANTES de qualquer chamada de IA.
    if (!CID_REGEX.test(code)) {
      return json({ status: 'invalid', code, description: null, simple_explanation: null });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Cache (não contém vínculo com aluno).
    const { data: cached } = await admin
      .from('cid_lookup_cache')
      .select('code, description, simple_explanation, source')
      .eq('code', code)
      .maybeSingle();

    if (cached?.description) {
      return json({
        status: 'ok',
        code,
        description: cached.description,
        simple_explanation: cached.simple_explanation,
        source: cached.source ?? 'ai',
        cached: true,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return json({ status: 'unknown', code, description: null, simple_explanation: null });
    }

    const tool = {
      type: 'function',
      function: {
        name: 'cid_description',
        description: 'Retorna a descrição oficial da CID-10 para o código informado',
        parameters: {
          type: 'object',
          properties: {
            known: { type: 'boolean' },
            description: { type: 'string' },
            simple_explanation: { type: 'string' },
          },
          required: ['known'],
        },
      },
    };

    const systemPrompt =
      'Você consulta exclusivamente a nomenclatura oficial da CID-10. ' +
      'Receberá APENAS um código. Retorne a descrição oficial da categoria/subcategoria e uma explicação em linguagem simples (1 frase). ' +
      'É PROIBIDO inferir diagnóstico, gravidade, prognóstico, tratamento, medicação ou qualquer informação sobre pessoas. ' +
      'Se não reconhecer o código com segurança, retorne known=false e não invente descrição.';

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Código CID-10: ${code}` },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'cid_description' } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return json({ status: 'error', error: 'Limite de requisições excedido' }, 429);
      if (resp.status === 402) return json({ status: 'error', error: 'Créditos insuficientes' }, 402);
      console.error('AI error', resp.status, await resp.text());
      return json({ status: 'unknown', code, description: null, simple_explanation: null });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { known?: boolean; description?: string; simple_explanation?: string } = {};
    try { parsed = JSON.parse(args || '{}'); } catch { /* ignore */ }

    if (!parsed.known || !parsed.description) {
      return json({ status: 'unknown', code, description: null, simple_explanation: null });
    }

    await admin.from('cid_lookup_cache').upsert(
      {
        code,
        description: parsed.description,
        simple_explanation: parsed.simple_explanation ?? null,
        source: 'ai',
      },
      { onConflict: 'code' },
    );

    return json({
      status: 'ok',
      code,
      description: parsed.description,
      simple_explanation: parsed.simple_explanation ?? null,
      source: 'ai',
      cached: false,
    });
  } catch (e) {
    console.error(e);
    return json({ status: 'error', error: 'Erro desconhecido' }, 500);
  }
});
