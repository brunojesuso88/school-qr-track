import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const eventSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    enfoque: { type: 'string' },
    metas: { type: 'string' },
    pontos_atencao: { type: 'string' },
    acoes_estrategicas: { type: 'array', items: { type: 'string' } },
    procedimentos: { type: 'array', items: { type: 'string' } },
    responsaveis: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['planejado', 'em_andamento', 'concluido', 'arquivado'] },
    tags: { type: 'array', items: { type: 'string' } },
    resumo_ia: { type: 'string' },
  },
  required: ['title', 'enfoque', 'metas', 'acoes_estrategicas', 'procedimentos', 'resumo_ia']
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { draft } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ success: false, error: 'IA não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente pedagógico institucional brasileiro. Receba o rascunho de um evento escolar e devolva a versão completa, profissional e em linguagem institucional. Preencha os campos faltantes coerentemente. Ações estratégicas começam com verbo no INFINITIVO; procedimentos no GERÚNDIO. O resumo deve ter 1-2 frases.' },
          { role: 'user', content: `Rascunho do evento:\n${JSON.stringify(draft || {}, null, 2)}` },
        ],
        tools: [{ type: 'function', function: { name: 'fill_event', description: 'Preenche evento institucional', parameters: eventSchema } }],
        tool_choice: { type: 'function', function: { name: 'fill_event' } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos insuficientes' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.error('AI error', resp.status);
      return new Response(JSON.stringify({ success: false, error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const event = args ? JSON.parse(args) : {};
    return new Response(JSON.stringify({ success: true, event }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});