import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Size limits
const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const PRIMARY_MODEL = 'google/gemini-2.5-pro';
const FALLBACK_MODEL = 'google/gemini-2.5-flash';

const normalizeName = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function callGateway(model: string, body: any, apiKey: string) {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, model }),
  });
}

async function callWithFallback(body: any, apiKey: string) {
  let res = await callGateway(PRIMARY_MODEL, body, apiKey);
  if (!res.ok && (res.status === 429 || res.status === 402 || res.status >= 500)) {
    console.warn(`Primary model ${PRIMARY_MODEL} failed (${res.status}), falling back to ${FALLBACK_MODEL}`);
    res = await callGateway(FALLBACK_MODEL, body, apiKey);
  }
  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, className, shift } = await req.json();

    // Validate required fields
    if (!pdfBase64 || !className) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF e nome da turma são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate className length and format
    if (typeof className !== 'string' || className.length < 1 || className.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome da turma inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate shift if provided
    const validShifts = ['morning', 'afternoon', 'evening'];
    if (shift && !validShifts.includes(shift)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Turno inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate approximate decoded size (base64 is ~33% larger than original)
    const estimatedSize = (pdfBase64.length * 3) / 4;
    if (estimatedSize > MAX_PDF_SIZE_BYTES) {
      console.error(`PDF too large: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `PDF muito grande. Tamanho máximo: ${MAX_PDF_SIZE_MB}MB` 
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PDF format by checking header
    try {
      const pdfHeader = atob(pdfBase64.substring(0, 100));
      if (!pdfHeader.startsWith('%PDF-')) {
        console.error('Invalid PDF header');
        return new Response(
          JSON.stringify({ success: false, error: 'Arquivo inválido. Envie um PDF válido.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      console.error('Error decoding PDF header:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo inválido. Envie um PDF válido.' }),
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

    console.log('Processing PDF for class:', className, '| Size:', (estimatedSize / 1024 / 1024).toFixed(2), 'MB');

    // ===== PASS 1: extraction with struck-through detection =====
    const extractionBody = {
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em OCR de listas escolares brasileiras. Extraia TODOS os nomes de alunos do documento com máxima precisão, letra por letra.

REGRAS CRÍTICAS:
1. Classifique cada nome em DOIS GRUPOS distintos:
   - "active_students": nomes legíveis SEM marcação de remoção.
   - "struck_students": nomes TACHADOS (linha horizontal cortando o nome), RISCADOS em vermelho/caneta, com X sobre o nome, marcados como "transferido", "desistente", "removido", "cancelado", "excluído", ou riscados de qualquer forma visual.
2. Examine atentamente o estilo visual de cada linha: cor diferente (vermelho), texto cortado, riscos manuais sobre o nome → SEMPRE struck_students.
3. Preserve acentos e ortografia exata. NÃO invente nomes. NÃO complete nomes parciais.
4. Para cada aluno, informe "confidence" (0.0–1.0) baseado na clareza da leitura.
5. Ignore cabeçalhos, números de ordem, rótulos como "Nome", "Aluno", "Responsável".`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia os alunos deste PDF separando ATIVOS de TACHADOS/RISCADOS. Inclua confidence em cada nome.' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
          ]
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'extract_students',
          description: 'Extrai e classifica alunos como ativos ou tachados',
          parameters: {
            type: 'object',
            properties: {
              active_students: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    full_name: { type: 'string' },
                    birth_date: { type: 'string', description: 'YYYY-MM-DD se disponível' },
                    guardian_name: { type: 'string' },
                    guardian_phone: { type: 'string' },
                    confidence: { type: 'number' }
                  },
                  required: ['full_name']
                }
              },
              struck_students: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    full_name: { type: 'string' },
                    reason: { type: 'string', description: 'Por que foi classificado como tachado/riscado' },
                    confidence: { type: 'number' }
                  },
                  required: ['full_name']
                }
              }
            },
            required: ['active_students', 'struck_students']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'extract_students' } }
    };

    const response = await callWithFallback(extractionBody, LOVABLE_API_KEY);

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
    console.log('Pass 1 (extraction) response received');

    let activeRaw: any[] = [];
    let struckRaw: any[] = [];
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        activeRaw = parsed.active_students || parsed.students || [];
        struckRaw = parsed.struck_students || [];
      } catch (e) {
        console.error('Error parsing pass 1 arguments:', e);
      }
    }
    console.log(`Pass 1: ${activeRaw.length} active, ${struckRaw.length} struck`);

    // ===== PASS 2: verification =====
    try {
      const verifyBody = {
        messages: [
          {
            role: 'system',
            content: `Você é um revisor de OCR. Receberá o PDF original e uma classificação preliminar de alunos. Sua tarefa:
1. Verifique cada nome letra por letra contra o PDF e corrija erros de leitura.
2. Reclassifique para "struck" qualquer nome que esteja tachado/riscado no PDF mas foi listado como ativo.
3. Reclassifique para "active" qualquer nome que NÃO esteja tachado mas foi listado como struck.
4. Remova entradas que NÃO existem de fato no documento (alucinação).
5. Adicione nomes que estão claramente no documento mas foram omitidos.
Devolva a lista FINAL e corrigida.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Classificação preliminar a revisar:

ATIVOS (${activeRaw.length}):
${activeRaw.map((s: any, i: number) => `${i + 1}. ${s.full_name}`).join('\n')}

TACHADOS (${struckRaw.length}):
${struckRaw.map((s: any, i: number) => `${i + 1}. ${s.full_name}`).join('\n')}

Compare com o PDF abaixo e retorne a lista final corrigida.`
              },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
            ]
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'verified_students',
            description: 'Lista final verificada de alunos',
            parameters: {
              type: 'object',
              properties: {
                active_students: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      birth_date: { type: 'string' },
                      guardian_name: { type: 'string' },
                      guardian_phone: { type: 'string' },
                      confidence: { type: 'number' }
                    },
                    required: ['full_name']
                  }
                },
                struck_students: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      reason: { type: 'string' },
                      confidence: { type: 'number' }
                    },
                    required: ['full_name']
                  }
                }
              },
              required: ['active_students', 'struck_students']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'verified_students' } }
      };

      const verifyRes = await callWithFallback(verifyBody, LOVABLE_API_KEY);
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const vCall = verifyData.choices?.[0]?.message?.tool_calls?.[0];
        if (vCall?.function?.arguments) {
          const vParsed = JSON.parse(vCall.function.arguments);
          if (Array.isArray(vParsed.active_students) && Array.isArray(vParsed.struck_students)) {
            activeRaw = vParsed.active_students;
            struckRaw = vParsed.struck_students;
            console.log(`Pass 2 (verified): ${activeRaw.length} active, ${struckRaw.length} struck`);
          }
        }
      } else {
        console.warn('Pass 2 verification failed, using pass 1 results. Status:', verifyRes.status);
      }
    } catch (e) {
      console.warn('Pass 2 error, using pass 1 results:', e);
    }

    // Phone number validation regex
    const phoneRegex = /^\d{10,11}$/;

    // Dedupe active and struck by normalized name; struck wins over active when conflict
    const struckKeys = new Set<string>();
    const struckFormatted = struckRaw
      .map((s: any) => {
        const full_name = String(s.full_name || '').trim().substring(0, 100);
        return {
          full_name,
          reason: String(s.reason || 'Tachado/riscado no PDF').substring(0, 200),
          confidence: typeof s.confidence === 'number' ? s.confidence : 0.9,
        };
      })
      .filter((s) => s.full_name.length >= 2)
      .filter((s) => {
        const k = normalizeName(s.full_name);
        if (struckKeys.has(k)) return false;
        struckKeys.add(k);
        return true;
      });

    const activeKeys = new Set<string>();
    const activeFormatted = activeRaw
      .map((student: any) => {
        const rawPhone = String(student.guardian_phone || student.telefone || '').replace(/\D/g, '');
        return {
          full_name: String(student.full_name || student.nome || '').trim().substring(0, 100),
          birth_date: student.birth_date || student.data_nascimento || null,
          guardian_name: String(student.guardian_name || student.responsavel || 'Responsável').substring(0, 100),
          guardian_phone: phoneRegex.test(rawPhone) ? rawPhone : '',
          class: className.substring(0, 100),
          shift: shift || 'morning',
          confidence: typeof student.confidence === 'number' ? student.confidence : 0.9,
        };
      })
      .filter((s: any) => s.full_name.length >= 2)
      .filter((s: any) => {
        const k = normalizeName(s.full_name);
        if (struckKeys.has(k)) return false; // struck wins
        if (activeKeys.has(k)) return false;
        activeKeys.add(k);
        return true;
      });

    console.log(`Final: ${activeFormatted.length} active, ${struckFormatted.length} struck`);

    return new Response(
      JSON.stringify({
        success: true,
        active: activeFormatted,
        struck: struckFormatted,
        students: activeFormatted, // backward compatibility
        count: activeFormatted.length,
      }),
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
