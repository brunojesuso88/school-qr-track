import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIELD_PROMPTS: Record<string, string> = {
  justificativa: 'Escreva a JUSTIFICATIVA institucional do projeto (1 parágrafo de 4-6 frases): contexto, problema, relevância pedagógica e fundamentação.',
  objetivo_geral: 'Escreva um OBJETIVO GERAL em uma única frase iniciada por verbo no infinitivo, amplo e alinhado à justificativa.',
  objetivos_especificos: 'Liste 4-6 OBJETIVOS ESPECÍFICOS, cada um iniciando por verbo no infinitivo, desdobrando o objetivo geral.',
  acoes_estrategicas: 'Liste 4-8 itens do PLANO ESTRATÉGICO DO PROJETO (ações iniciando por verbo no infinitivo).',
  metodologia: 'Descreva a METODOLOGIA (1 parágrafo de 4-6 frases): abordagem pedagógica, etapas, dinâmicas, materiais e parcerias.',
  recursos: 'Liste 4-8 RECURSOS NECESSÁRIOS organizados por categoria (humanos, materiais, financeiros, espaços).',
  culminancia: 'Descreva a CULMINÂNCIA do projeto (2-4 frases): evento ou produto final que encerra e celebra o projeto.',
  avaliacao: 'Descreva a AVALIAÇÃO do projeto (3-5 frases): critérios, instrumentos, indicadores e momentos avaliativos.',
  tags: 'Gere 3-6 tags curtas (1-2 palavras) categorizando o projeto.',
  resumo_ia: 'Gere um RESUMO institucional curto (1-2 frases) profissional para descrever o projeto.',
  title: 'Sugira um título institucional curto e claro para o projeto.',
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

    const isList = ['acoes_estrategicas', 'objetivos_especificos', 'recursos', 'tags'].includes(field);

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