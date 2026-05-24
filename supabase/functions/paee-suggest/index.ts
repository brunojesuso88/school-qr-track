import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AREA_LABELS: Record<string, string> = {
  cognitiva: 'Cognitiva (atenção, memória, raciocínio, funções executivas)',
  motora: 'Motora (coordenação ampla e fina, lateralidade, equilíbrio)',
  comunicacao: 'Comunicação (linguagem oral, escrita, alternativa, compreensão)',
  social: 'Social (interação, vínculos, cooperação, autonomia)',
  comportamento: 'Comportamento (autorregulação, frustração, rotina, engajamento)',
};

const FIELD_LABELS: Record<string, string> = {
  objectives: 'OBJETIVOS pedagógicos específicos, mensuráveis e iniciando por verbo no infinitivo',
  strategies: 'ESTRATÉGIAS de atendimento (recursos, técnicas, materiais e procedimentos práticos)',
  evaluation_record: 'REGISTRO AVALIATIVO descritivo (indicadores de progresso, formas de observação e evidências)',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { area, field, context } = await req.json();
    if (!area || !AREA_LABELS[area] || !field || !FIELD_LABELS[field]) {
      return new Response(JSON.stringify({ success: false, error: 'Área ou campo inválido' }), {
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
        description: 'Devolve sugestões pedagógicas para o PAEE',
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 6 },
          },
          required: ['items'],
        },
      },
    };

    const systemPrompt =
      'Você é um(a) Professor(a) de AEE brasileiro(a), especialista em Educação Especial inclusiva, com base na BNCC, LBI e modelo PAEE de Caxias/MA. ' +
      'Gere sugestões curtas, práticas, formais e individualizadas. Cada item deve ter 1-2 frases, ser aplicável em sala de recursos e respeitar a deficiência/CID do estudante quando informada.';

    const userPrompt =
      `Contexto do estudante:\n${JSON.stringify(context || {}, null, 2)}\n\n` +
      `Área pedagógica: ${AREA_LABELS[area]}.\n` +
      `Campo solicitado: ${FIELD_LABELS[field]}.\n\n` +
      `Gere 5 sugestões adequadas para a deficiência/CID informada (ou genéricas se ausente).`;

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