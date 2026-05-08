import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIELD_PROMPTS: Record<string, string> = {
  enfoque: 'Sugira um ENFOQUE educacional institucional curto (1-2 frases) para o evento.',
  metas: 'Sugira METAS SMART mensuráveis (2-3 frases) para o evento, com indicadores quantitativos.',
  pontos_atencao: 'Liste 3-5 PONTOS DE ATENÇÃO críticos relacionados ao evento, em frases curtas.',
  acoes_estrategicas: 'Liste 4-6 AÇÕES ESTRATÉGICAS começando com verbo no INFINITIVO.',
  procedimentos: 'Converta as ações estratégicas em PROCEDIMENTOS executáveis começando com verbo no GERÚNDIO.',
  tags: 'Gere 3-6 tags curtas (1-2 palavras) categorizando o evento.',
  resumo_ia: 'Gere um RESUMO institucional curto (1-2 frases) profissional para descrever o evento.',
  title: 'Sugira um título institucional curto e claro para o evento.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { field, context } = await req.json();
    if (!field || !FIELD_PROMPTS[field]) {
      return new Response(JSON.stringify({ success: false, error: 'Campo inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'IA não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isList = ['acoes_estrategicas', 'procedimentos', 'tags', 'pontos_atencao'].includes(field);

    const tool = {
      type: 'function',
      function: {
        name: 'suggest',
        description: 'Devolve sugestão para o campo solicitado',
        parameters: isList
          ? { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: ['items'] }
          : { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      }
    };

    const systemPrompt = `Você é um assistente pedagógico institucional brasileiro. Use linguagem educacional formal, clara e objetiva. ${FIELD_PROMPTS[field]}`;
    const userPrompt = `Contexto do evento:\n${JSON.stringify(context || {}, null, 2)}\n\nGere a sugestão para o campo "${field}".`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
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
      if (resp.status === 429) return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos insuficientes' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      return new Response(JSON.stringify({ success: false, error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try { parsed = JSON.parse(args || '{}'); } catch { /* ignore */ }

    return new Response(JSON.stringify({ success: true, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});