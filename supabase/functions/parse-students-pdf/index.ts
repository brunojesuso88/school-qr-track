import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Size limits
const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Use Flash as primary to avoid Pro rate/credit limits (402/429) on common imports.
const PRIMARY_MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';

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

const VALID_ACTIVE_SITUATIONS = ['MTR', 'MTI'];
const VALID_REMOVED_SITUATIONS = ['CTI', 'CPG', 'TRA', 'DES', 'REM', 'CTE'];

function buildExtractionBody(pdfBase64: string, passLabel: string) {
  return {
    messages: [
      {
        role: 'system',
        content: `Você analisa listas escolares em PDF. Examine TODAS as páginas, linha por linha, e reporte cada aluno encontrado.

CAMPO MAIS IMPORTANTE — situacao:
Leia EXATAMENTE a sigla da coluna "Situação" de cada linha. Valores comuns: MTR, MTI (alunos ativos/matriculados); CTI, CPG, TRA, DES, REM (alunos removidos/transferidos/desistentes). Se a célula estiver vazia, retorne "".

Para cada aluno reporte:
- full_name: nome exato como aparece (preserve acentos)
- situacao: sigla EXATA da coluna Situação (em maiúsculas)
- name_color: "black" | "red" | "other" — apenas se claramente visível, senão use "black"
- has_strikethrough: true apenas se houver rachura óbvia sobre o nome
- page: número da página (1-indexed)
- guardian_name, guardian_phone, birth_date: quando visíveis

REGRAS:
1. Examine TODAS as páginas — nenhuma linha pode ser omitida.
2. Não invente nomes nem complete nomes parciais.
3. Ignore cabeçalhos, rodapés e números de ordem.
4. Priorize a leitura correta da coluna Situação acima de qualquer outro sinal.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analise TODAS as páginas deste PDF e reporte cada linha de aluno (${passLabel}).` },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
        ]
      }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'report_rows',
        description: 'Reporta cada linha de aluno observada no PDF',
        parameters: {
          type: 'object',
          properties: {
            pages_read: { type: 'number' },
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  full_name: { type: 'string' },
                  name_color: { type: 'string', enum: ['black', 'red', 'other'] },
                  has_strikethrough: { type: 'boolean' },
                  situacao: { type: 'string' },
                  page: { type: 'number' },
                  guardian_name: { type: 'string' },
                  guardian_phone: { type: 'string' },
                  birth_date: { type: 'string' },
                },
                required: ['full_name', 'situacao']
              }
            }
          },
          required: ['rows', 'pages_read']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'report_rows' } }
  };
}

async function runExtractionPass(pdfBase64: string, passLabel: string, apiKey: string) {
  const res = await callWithFallback(buildExtractionBody(pdfBase64, passLabel), apiKey);
  if (!res.ok) {
    const txt = await res.text();
    console.error(`${passLabel} failed:`, res.status, txt);
    return { ok: false, status: res.status, rows: [] as any[], pages: 0 };
  }
  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return { ok: false, status: 500, rows: [], pages: 0 };
  try {
    const parsed = JSON.parse(call.function.arguments);
    return {
      ok: true,
      status: 200,
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      pages: Number(parsed.pages_read) || 0,
    };
  } catch (e) {
    console.error(`${passLabel} parse error:`, e);
    return { ok: false, status: 500, rows: [], pages: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction', 'teacher']);
    if (auth instanceof Response) return auth;

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

    // ===== Passe único (Flash) — situacao é o sinal primário =====
    const pass = await runExtractionPass(pdfBase64, 'Único', LOVABLE_API_KEY);

    if (!pass.ok) {
      const status = pass.status === 402 ? 402 : pass.status === 429 ? 429 : 500;
      const msg = status === 429 ? 'Limite de requisições excedido. Tente novamente em alguns minutos.'
        : status === 402 ? 'Créditos de IA insuficientes. Adicione créditos à sua conta.'
        : 'Falha ao analisar o PDF. Estrutura desconhecida ou ilegível.';
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pagesRead = pass.pages;
    console.log(`Passe único: ${pass.rows.length} rows | pages=${pagesRead}`);

    const phoneRegex = /^\d{10,11}$/;
    const nameValid = (n: string) => /^[\p{L}\s'\-\.]+$/u.test(n) && n.trim().length >= 2;

    const active: any[] = [];
    const removed: any[] = [];
    const review: any[] = [];
    const seen = new Set<string>();

    for (const r of pass.rows) {
      const full_name = String(r.full_name || '').trim().substring(0, 100);
      const key = normalizeName(full_name);
      if (key.length < 2 || seen.has(key)) continue;
      seen.add(key);

      const color = String(r.name_color || 'black').toLowerCase();
      const strike = !!r.has_strikethrough;
      const situacao = String(r.situacao || '').trim().toUpperCase();
      const rawPhone = String(r.guardian_phone || '').replace(/\D/g, '');

      const base = {
        full_name,
        page: r.page ?? null,
        name_color: color,
        has_strikethrough: strike,
        situacao,
        birth_date: r.birth_date || null,
        guardian_name: String(r.guardian_name || '').substring(0, 100),
        guardian_phone: phoneRegex.test(rawPhone) ? rawPhone : '',
        class: className.substring(0, 100),
        shift: shift || 'morning',
      };

      // Situação é o sinal PRIMÁRIO e determinístico
      const isActiveBySit = VALID_ACTIVE_SITUATIONS.includes(situacao);
      const isRemovedBySit = VALID_REMOVED_SITUATIONS.includes(situacao);

      if (!nameValid(full_name)) {
        review.push({ ...base, reasons: ['Nome com caracteres suspeitos'], suggested: 'unknown' });
        continue;
      }

      if (isActiveBySit) {
        active.push(base);
      } else if (isRemovedBySit) {
        const reason = situacao === 'CTI' || situacao === 'CPG' || situacao === 'CTE' ? 'strike'
          : color === 'red' ? 'red' : 'strike';
        removed.push({ ...base, reason });
      } else if (color === 'red' || strike) {
        // Fallback visual quando situação está ausente
        removed.push({ ...base, reason: color === 'red' && strike ? 'both' : color === 'red' ? 'red' : 'strike' });
      } else if (!situacao) {
        // Sem situação e sem sinais visuais → trata como ativo (padrão da lista escolar)
        active.push(base);
      } else {
        review.push({
          ...base,
          reasons: [`Situação "${situacao}" não reconhecida`],
          suggested: 'unknown',
        });
      }
    }

    const stats = {
      pages: pagesRead,
      total: seen.size,
      active: active.length,
      removed: removed.length,
      review: review.length,
      rows_read: pass.rows.length,
    };
    console.log('Final stats:', stats);

    return new Response(
      JSON.stringify({ success: true, active, removed, review, stats }),
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
