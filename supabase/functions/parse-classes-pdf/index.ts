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

    console.log('Processing classes PDF | Size:', (estimatedSize / 1024 / 1024).toFixed(2), 'MB');

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
            content: `Você é um assistente especializado em extrair dados escolares de documentos PDF (grades horárias, planilhas de distribuição de turmas e disciplinas).
Analise o documento com RIGOR MÁXIMO e extraia TODAS as turmas que encontrar.
Para cada turma identifique:
- Nome da turma (ex.: "1A", "2ºB", "1º Ano A", "3M1")
- Turno (se disponível): morning, afternoon ou evening
- Lista de disciplinas associadas, cada uma com:
  * Nome da disciplina (nome completo OU abreviação, como aparece no documento — ex.: "Matemática" ou "MAT")
  * Carga semanal (número de aulas por semana, se disponível; senão omita)
  * Nome completo do professor responsável (se disponível)
  * Abreviação/sigla do professor (se disponível, ex.: "JMS", "M.S.")

Seja rigoroso: extraia TUDO que aparecer no documento — disciplinas, professores e turmas. Ignore cabeçalhos, títulos e legendas.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este PDF e extraia todas as turmas, suas disciplinas e os professores responsáveis.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_classes',
              description: 'Extrai turmas com suas disciplinas e professores responsáveis',
              parameters: {
                type: 'object',
                properties: {
                  classes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Nome da turma' },
                        shift: { type: 'string', description: 'morning | afternoon | evening' },
                        subjects: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string', description: 'Nome ou abreviação da disciplina' },
                              weekly_classes: { type: 'number', description: 'Aulas semanais (opcional)' },
                              teacher_name: { type: 'string', description: 'Nome completo do professor (opcional)' },
                              teacher_abbreviation: { type: 'string', description: 'Sigla do professor (opcional)' }
                            },
                            required: ['name']
                          }
                        }
                      },
                      required: ['name', 'subjects']
                    }
                  }
                },
                required: ['classes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_classes' } }
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
    let classes: any[] = [];

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        classes = parsed.classes || [];
      } catch (e) {
        console.error('Error parsing tool call arguments:', e);
      }
    }

    const normalizeShift = (s: any): string | null => {
      const v = String(s || '').toLowerCase().trim();
      if (v === 'afternoon' || v === 'tarde') return 'afternoon';
      if (v === 'evening' || v === 'night' || v === 'noite') return 'evening';
      if (v === 'morning' || v === 'manha' || v === 'manhã') return 'morning';
      return null;
    };

    const formatted = classes
      .map((c: any) => ({
        name: String(c.name || '').trim().substring(0, 100),
        shift: normalizeShift(c.shift),
        subjects: Array.isArray(c.subjects)
          ? c.subjects
              .map((s: any) => ({
                name: String(s.name || '').trim().substring(0, 100),
                weekly_classes: Number(s.weekly_classes) > 0 ? Number(s.weekly_classes) : null,
                teacher_name: String(s.teacher_name || '').trim().substring(0, 100) || null,
                teacher_abbreviation: String(s.teacher_abbreviation || '').trim().toUpperCase().substring(0, 10) || null,
              }))
              .filter((s: any) => s.name.length > 0)
          : [],
      }))
      .filter((c: any) => c.name.length > 0 && c.subjects.length > 0);

    console.log('Extracted classes:', formatted.length);

    return new Response(
      JSON.stringify({ success: true, classes: formatted, count: formatted.length }),
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