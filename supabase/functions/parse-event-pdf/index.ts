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
    title: { type: 'string', description: 'Título do projeto, claro e curto.' },
    justificativa: { type: 'string', description: 'JUSTIFICATIVA: contexto, problema, relevância e fundamentação do projeto.' },
    objetivo_geral: { type: 'string', description: 'OBJETIVO GERAL em uma única frase, iniciada por verbo no infinitivo.' },
    objetivos_especificos: { type: 'array', items: { type: 'string' }, description: 'OBJETIVOS ESPECÍFICOS — itens iniciados por verbo no infinitivo.' },
    acoes_estrategicas: { type: 'array', items: { type: 'string' }, description: 'PLANO ESTRATÉGICO DO PROJETO — lista de ações iniciadas por verbo no infinitivo.' },
    metodologia: { type: 'string', description: 'METODOLOGIA: abordagem pedagógica, etapas, dinâmicas, parcerias.' },
    cronograma: { type: 'array', items: { type: 'object', properties: { etapa: { type: 'string' }, periodo: { type: 'string' } }, required: ['etapa', 'periodo'] }, description: 'CRONOGRAMA: lista de etapas/atividades com seu período (mês/ano ou datas).' },
    recursos: { type: 'array', items: { type: 'string' }, description: 'RECURSOS NECESSÁRIOS: humanos, materiais, financeiros, espaços.' },
    culminancia: { type: 'string', description: 'CULMINÂNCIA: evento ou produto final que encerra o projeto.' },
    avaliacao: { type: 'string', description: 'AVALIAÇÃO: critérios, instrumentos e indicadores avaliativos.' },
    responsaveis: { type: 'array', items: { type: 'string' }, description: 'Nomes ou cargos dos responsáveis citados.' },
    prazo_inicio: { type: 'string', description: 'Data de início YYYY-MM-DD. Use "" se não houver.' },
    prazo_fim: { type: 'string', description: 'Data de término YYYY-MM-DD. Use "" se não houver.' },
    is_continuous: { type: 'boolean', description: 'true se o projeto é contínuo/anual sem data fim definida.' },
    status: { type: 'string', enum: ['planejado', 'em_andamento', 'concluido', 'arquivado'] },
    tags: { type: 'array', items: { type: 'string' }, description: '3 a 8 palavras-chave classificatórias.' },
    resumo_ia: { type: 'string', description: 'Resumo institucional curto (2-3 frases).' },
  },
  required: ['title', 'justificativa', 'objetivo_geral', 'objetivos_especificos', 'acoes_estrategicas', 'metodologia', 'cronograma', 'recursos', 'culminancia', 'avaliacao', 'responsaveis', 'prazo_inicio', 'prazo_fim', 'is_continuous', 'status', 'tags', 'resumo_ia']
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

    const systemPrompt = `Você é um assistente especialista em análise de projetos pedagógicos escolares brasileiros.

Sua tarefa: extrair de forma EXAUSTIVA todas as informações do documento e preencher TODOS os campos do schema seguindo a estrutura institucional padrão. Não invente — se algo não estiver no documento, deixe vazio (string vazia ou array vazio), mas SEMPRE retorne todos os campos.

Mapeamento (estrutura institucional do projeto):
- title: nome do projeto.
- IDENTIFICAÇÃO: responsaveis, prazo_inicio/prazo_fim (YYYY-MM-DD; converta "março de 2026" → "2026-03-01"), is_continuous, status, tags, resumo_ia.
- 1. justificativa: contexto, problema, relevância, fundamentação.
- 2. objetivo_geral: frase única iniciada por verbo no infinitivo.
- 3. objetivos_especificos: lista; cada item começando por verbo no infinitivo.
- 4. acoes_estrategicas (Plano Estratégico do Projeto): lista de ações no infinitivo.
- 5. metodologia: abordagem, etapas, dinâmicas, parcerias.
- 6. cronograma: lista [{etapa, periodo}]. Capture nome da etapa e o período (ex.: "mar/2026", "1ª semana de abril").
- 7. recursos: humanos, materiais, financeiros, espaços.
- 8. culminancia: evento/produto final.
- 9. avaliacao: critérios, instrumentos, indicadores.

IMPORTANTE: PRESERVE a redação original do documento sempre que possível. Datas em YYYY-MM-DD obrigatoriamente.`;

    const callModel = async (model: string) => fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: 'Analise o documento PDF anexo e extraia TODOS os campos solicitados, preservando a redação original.' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
          ] },
        ],
        tools: [{ type: 'function', function: { name: 'extract_event', description: 'Extrai evento do PDF', parameters: eventSchema } }],
        tool_choice: { type: 'function', function: { name: 'extract_event' } },
      }),
    });

    let resp = await callModel('google/gemini-2.5-pro');
    if (resp.status === 429 || resp.status === 503) {
      console.log('Falling back to gemini-2.5-flash');
      resp = await callModel('google/gemini-2.5-flash');
    }

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