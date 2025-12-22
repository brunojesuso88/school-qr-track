import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, className, shift } = await req.json();

    if (!pdfBase64 || !className) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF e nome da turma são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing PDF for class:', className);

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
            content: `Você é um assistente especializado em extrair dados de alunos de documentos PDF.
Analise o documento e extraia todas as informações de alunos que encontrar.
Para cada aluno, tente identificar:
- Nome completo (obrigatório)
- Data de nascimento (formato YYYY-MM-DD, se disponível)
- Nome do responsável (se disponível)
- Telefone do responsável (se disponível)

Retorne os dados no formato JSON.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este documento PDF e extraia todos os dados de alunos. Retorne um array JSON com os alunos encontrados.`
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
              name: 'extract_students',
              description: 'Extrai dados de alunos do documento',
              parameters: {
                type: 'object',
                properties: {
                  students: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        full_name: { type: 'string', description: 'Nome completo do aluno' },
                        birth_date: { type: 'string', description: 'Data de nascimento no formato YYYY-MM-DD' },
                        guardian_name: { type: 'string', description: 'Nome do responsável' },
                        guardian_phone: { type: 'string', description: 'Telefone do responsável' }
                      },
                      required: ['full_name']
                    }
                  }
                },
                required: ['students']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_students' } }
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
          JSON.stringify({ success: false, error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar documento com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    let students: any[] = [];
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        students = parsed.students || [];
      } catch (e) {
        console.error('Error parsing tool call arguments:', e);
      }
    }

    if (students.length === 0) {
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          students = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Error parsing content JSON:', e);
        }
      }
    }

    console.log('Extracted students:', students.length);

    const formattedStudents = students.map((student: any) => ({
      full_name: student.full_name || student.nome || student.name || '',
      birth_date: student.birth_date || student.data_nascimento || null,
      guardian_name: student.guardian_name || student.responsavel || student.nome_responsavel || 'Responsável',
      guardian_phone: student.guardian_phone || student.telefone || student.telefone_responsavel || '00000000000',
      class: className,
      shift: shift || 'morning'
    })).filter((s: any) => s.full_name.trim() !== '');

    return new Response(
      JSON.stringify({ 
        success: true, 
        students: formattedStudents,
        count: formattedStudents.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
