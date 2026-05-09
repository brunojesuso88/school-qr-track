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
    title: { type: 'string', description: 'Título do evento/ata, claro e curto' },
    enfoque: { type: 'string', description: 'Indicador, eixo, tema ou foco pedagógico do evento. Ex.: "Fluxo escolar", "Aprendizagem em Matemática"' },
    metas: { type: 'string', description: 'Resultados mensuráveis esperados (formato SMART). Preserve a redação do documento.' },
    pontos_atencao: { type: 'string', description: 'Problemas, riscos, dificuldades ou desafios identificados no documento.' },
    acoes_estrategicas: { type: 'array', items: { type: 'string' }, description: 'Ações/estratégias listadas no documento. Preserve a redação original.' },
    procedimentos: { type: 'array', items: { type: 'string' }, description: 'Procedimentos, etapas operacionais, atividades específicas. Preserve a redação original.' },
    responsaveis: { type: 'array', items: { type: 'string' }, description: 'Nomes ou cargos das pessoas/equipes responsáveis citados no documento.' },
    prazo_inicio: { type: 'string', description: 'Data de início no formato YYYY-MM-DD. Use string vazia "" se não houver.' },
    prazo_fim: { type: 'string', description: 'Data de término no formato YYYY-MM-DD. Use string vazia "" se não houver.' },
    is_continuous: { type: 'boolean', description: 'true quando o documento descreve um evento/ação contínua, projeto anual ou sem data fim definida.' },
    status: { type: 'string', enum: ['planejado', 'em_andamento', 'concluido', 'arquivado'], description: 'Inferir do documento: ata de planejamento → planejado; relatório em curso → em_andamento; relatório final → concluido.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave que classifiquem o evento (ex.: "BNCC", "Avaliação", "Reunião", "Formação").' },
    resumo_ia: { type: 'string', description: 'Resumo institucional de 2 a 3 frases sobre o documento.' },
  },
  required: ['title', 'enfoque', 'metas', 'pontos_atencao', 'acoes_estrategicas', 'procedimentos', 'responsaveis', 'prazo_inicio', 'prazo_fim', 'is_continuous', 'status', 'tags', 'resumo_ia']
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

    const systemPrompt = `Você é um assistente especialista em análise de documentos escolares brasileiros (atas, relatórios, projetos pedagógicos, planos de ação).

Sua tarefa: extrair de forma EXAUSTIVA todas as informações do documento e preencher TODOS os campos do schema. Não invente — se algo não estiver no documento, deixe vazio (string vazia ou array vazio), mas SEMPRE retorne todos os campos.

Como mapear cada campo:
- title: nome do evento, ata, projeto ou reunião descrito.
- enfoque: tema/eixo/indicador pedagógico principal (ex.: "Fluxo escolar", "Combate à evasão", "BNCC – Linguagens").
- metas: objetivos e metas mensuráveis (SMART). Procure por "Meta:", "Objetivo:", "Espera-se".
- pontos_atencao: problemas, dificuldades, riscos, desafios, observações críticas.
- acoes_estrategicas: lista de ações/estratégias previstas. Procure por "Ações:", "Estratégias:", listas numeradas.
- procedimentos: passos operacionais, etapas, atividades específicas. Procure por "Procedimentos:", "Como fazer:", "Etapas:".
- responsaveis: nomes próprios ou cargos citados como responsáveis/coordenadores.
- prazo_inicio / prazo_fim: datas no formato YYYY-MM-DD. Converta "março de 2026" → "2026-03-01". Se nada for citado, use "".
- is_continuous: true se for "projeto anual", "ação permanente", "atividade contínua", sem data fim clara.
- status: planejado (planejamento futuro), em_andamento (já iniciado), concluido (relatório final), arquivado.
- tags: 3 a 8 palavras-chave classificatórias.
- resumo_ia: resumo institucional curto (2-3 frases) do que o documento trata.

IMPORTANTE: PRESERVE a redação original do documento sempre que possível. Não reformule frases. Datas no formato YYYY-MM-DD obrigatoriamente.`;

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