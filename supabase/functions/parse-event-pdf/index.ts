import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const eventSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Título do evento' },
    enfoque: { type: 'string' },
    metas: { type: 'string' },
    pontos_atencao: { type: 'string' },
    acoes_estrategicas: { type: 'array', items: { type: 'string' } },
    procedimentos: { type: 'array', items: { type: 'string' } },
    responsaveis: { type: 'array', items: { type: 'string' } },
    prazo_inicio: { type: 'string', description: 'YYYY-MM-DD' },
    prazo_fim: { type: 'string', description: 'YYYY-MM-DD' },
    tags: { type: 'array', items: { type: 'string' } },
    resumo_ia: { type: 'string', description: 'Resumo institucional curto' },
  },
  required: ['title', 'resumo_ia']
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) return new Response(JSON.stringify({ success: false, error: 'PDF é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const estimatedSize = (pdfBase64.length * 3) / 4;
    if (estimatedSize > MAX_PDF_SIZE_BYTES) {
      return new Response(JSON.stringify({ success: false, error: `PDF muito grande. Máximo: ${MAX_PDF_SIZE_MB}MB` }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    try {
      const header = atob(pdfBase64.substring(0, 100));
      if (!header.startsWith('%PDF-')) {
        return new Response(JSON.stringify({ success: false, error: 'Arquivo PDF inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Arquivo PDF inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ success: false, error: 'IA não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Extraia de uma ata, relatório ou documento escolar os campos do evento institucional. Linguagem institucional brasileira. Ações no infinitivo, procedimentos no gerúndio. Datas no formato YYYY-MM-DD.' },
          { role: 'user', content: [
            { type: 'text', text: 'Analise o documento e preencha os campos.' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
          ] },
        ],
        tools: [{ type: 'function', function: { name: 'extract_event', description: 'Extrai evento do PDF', parameters: eventSchema } }],
        tool_choice: { type: 'function', function: { name: 'extract_event' } },
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
    const event = args ? JSON.parse(args) : {};
    return new Response(JSON.stringify({ success: true, event }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});