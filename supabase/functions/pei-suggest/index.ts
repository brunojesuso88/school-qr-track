import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIELD_LABELS: Record<string, string> = {
  functional_profile:
    'PERFIL FUNCIONAL DE APRENDIZAGEM (forma como o estudante aprende, comunicação, atenção, autonomia, estilo cognitivo)',
  potentialities:
    'POTENCIALIDADES (habilidades, interesses e pontos fortes do estudante)',
  learning_barriers:
    'BARREIRAS DE APRENDIZAGEM (dificuldades acadêmicas, comportamentais, sensoriais ou de organização)',
  evaluation_criteria:
    'AVALIAÇÃO E CRITÉRIOS (instrumentos, critérios de sucesso e tipo de adaptação avaliativa)',
  adapt_portugues_humanas:
    'ADAPTAÇÕES em LÍNGUA PORTUGUESA (estratégias, materiais e recursos pedagógicos)',
  adapt_matematica_exatas:
    'ADAPTAÇÕES em MATEMÁTICA e CIÊNCIAS DA NATUREZA (estratégias, materiais e recursos pedagógicos)',
  adapt_ciencias_humanas:
    'ADAPTAÇÕES em CIÊNCIAS HUMANAS (História, Geografia, Filosofia, Sociologia)',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction', 'teacher']);
    if (auth instanceof Response) return auth;

    const { field, context } = await req.json();
    if (!field || !FIELD_LABELS[field]) {
      return new Response(JSON.stringify({ success: false, error: 'Campo inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'IA não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tool = {
      type: 'function',
      function: {
        name: 'suggest',
        description: 'Devolve sugestões pedagógicas para o PEI',
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 7 },
          },
          required: ['items'],
        },
      },
    };

    const systemPrompt =
      'Você é um(a) Professor(a) de AEE brasileiro(a) experiente, especialista em Educação Especial inclusiva, BNCC e LBI. ' +
      'Gere sugestões individualizadas, formais e prontas para colar em um Plano Educacional Individualizado (PEI). ' +
      'Cada item deve ter 1-2 frases, ser aplicável em sala regular e/ou sala de recursos multifuncional, e respeitar a deficiência/CID/perfil do estudante quando informados.';

    const userPrompt =
      `Contexto do estudante (use TODOS os dados pertinentes):\n${JSON.stringify(context || {}, null, 2)}\n\n` +
      `Campo do PEI: ${FIELD_LABELS[field]}.\n\n` +
      `Gere 6 sugestões diferentes entre si, adequadas ao perfil acima.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'suggest' } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402)
        return new Response(JSON.stringify({ success: false, error: 'Créditos insuficientes' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      return new Response(JSON.stringify({ success: false, error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { items?: string[] } = {};
    try { parsed = JSON.parse(args || '{}'); } catch { /* ignore */ }

    return new Response(JSON.stringify({ success: true, items: parsed.items || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});