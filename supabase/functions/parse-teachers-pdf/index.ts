import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Validate PDF header
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

    console.log('Processing teachers PDF | Size:', (estimatedSize / 1024 / 1024).toFixed(2), 'MB');

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
            content: `Você é um assistente especializado em extrair dados de professores de documentos PDF de escolas.
Analise o documento com rigor máximo e extraia TODOS os professores que encontrar.
Para cada professor, identifique:
- Nome completo (obrigatório)
- E-mail (se disponível)
- Telefone (se disponível)
- Carga horária semanal máxima (se disponível, default 20)
- Turmas/classes associadas ao professor (ex: 1A, 2B, 3ºA, 1º Ano A, etc.)

Seja rigoroso: extraia TODOS os nomes de professores e suas respectivas turmas.
As turmas podem aparecer como "1A", "1ºA", "1º Ano A", "Turma 1A", etc.
Se um professor leciona em múltiplas turmas, liste todas elas.
Ignore cabeçalhos, títulos e textos que não sejam nomes de professores.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este documento PDF e extraia todos os dados de professores encontrados, incluindo as turmas de cada professor. Seja rigoroso e extraia todos os nomes e turmas.'
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
              name: 'extract_teachers',
              description: 'Extrai dados de professores do documento, incluindo suas turmas',
              parameters: {
                type: 'object',
                properties: {
                  teachers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Nome completo do professor' },
                        email: { type: 'string', description: 'E-mail do professor' },
                        phone: { type: 'string', description: 'Telefone do professor' },
                        max_weekly_hours: { type: 'number', description: 'Carga horária semanal máxima' },
                        classes: { 
                          type: 'array', 
                          items: { type: 'string' }, 
                          description: 'Nomes das turmas/classes do professor (ex: 1A, 2B, 3ºA)' 
                        }
                      },
                      required: ['name']
                    }
                  }
                },
                required: ['teachers']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_teachers' } }
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
    let teachers: any[] = [];

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        teachers = parsed.teachers || [];
      } catch (e) {
        console.error('Error parsing tool call arguments:', e);
      }
    }

    if (teachers.length === 0) {
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          teachers = JSON.parse(jsonMatch[0]);
        } catch { /* ignore */ }
      }
    }

    console.log('Extracted teachers:', teachers.length);

    const formattedTeachers = teachers
      .map((t: any) => ({
        name: String(t.name || t.nome || '').trim().substring(0, 100),
        email: String(t.email || '').trim().substring(0, 100) || '',
        phone: String(t.phone || t.telefone || '').replace(/\D/g, '').substring(0, 15) || '',
        max_weekly_hours: Number(t.max_weekly_hours || t.carga_horaria || 20),
        classes: Array.isArray(t.classes) ? t.classes.map((c: any) => String(c).trim()).filter((c: string) => c.length > 0) : [],
      }))
      .filter((t: any) => t.name.length >= 2);

    return new Response(
      JSON.stringify({ success: true, teachers: formattedTeachers, count: formattedTeachers.length }),
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
