import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction']);
    if (auth instanceof Response) return auth;

    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const estimatedSize = (pdfBase64.length * 3) / 4;
    if (estimatedSize > MAX_PDF_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ success: false, error: `PDF muito grande. Máximo: ${MAX_PDF_SIZE_MB}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const pdfHeader = atob(pdfBase64.substring(0, 100));
      if (!pdfHeader.startsWith('%PDF-')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Arquivo inválido. Envie um PDF válido.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo inválido. Envie um PDF válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing subjects PDF | Size:', (estimatedSize / 1024 / 1024).toFixed(2), 'MB');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em extrair disciplinas escolares de documentos PDF.
Analise o documento e extraia TODAS as disciplinas únicas que encontrar.
Para cada disciplina, identifique:
- Nome completo (obrigatório, ex.: "Matemática", "Língua Portuguesa", "Educação Física")
- Abreviação/sigla (se aparecer no documento, ex.: "MAT", "POR", "Let. Mat.", "EF")
- Carga horária semanal (opcional, default 4)

Não duplique disciplinas. Se a mesma disciplina aparecer várias vezes com nomes ligeiramente diferentes, escolha o nome mais completo.
Ignore cabeçalhos, nomes de turmas e de professores.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este PDF e extraia todas as disciplinas com suas respectivas abreviações quando disponíveis.'
              },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_subjects',
              description: 'Extrai disciplinas do documento, incluindo nome completo e abreviação',
              parameters: {
                type: 'object',
                properties: {
                  subjects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Nome completo da disciplina' },
                        abbreviation: { type: 'string', description: 'Sigla/abreviação da disciplina (opcional)' },
                        default_weekly_classes: { type: 'number', description: 'Aulas por semana (default 4)' }
                      },
                      required: ['name']
                    }
                  }
                },
                required: ['subjects']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_subjects' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar documento com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let subjects: any[] = [];

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        subjects = parsed.subjects || [];
      } catch (e) {
        console.error('Error parsing tool call arguments:', e);
      }
    }

    const formatted = subjects
      .map((s: any) => ({
        name: String(s.name || s.nome || '').trim().substring(0, 100),
        abbreviation: String(s.abbreviation || s.sigla || '').trim().substring(0, 20) || '',
        default_weekly_classes: Number(s.default_weekly_classes || s.aulas_semana || 4),
      }))
      .filter((s: any) => s.name.length >= 2);

    console.log('Extracted subjects:', formatted.length);

    return new Response(
      JSON.stringify({ success: true, subjects: formatted, count: formatted.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro desconhecido ao processar PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});