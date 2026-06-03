import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

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

const VALID_ACTIVE_SITUATIONS = ['MTR', 'MTI'];
const VALID_REMOVED_SITUATIONS = ['CTI', 'CPG'];

function buildExtractionBody(pdfBase64: string, passLabel: string) {
  return {
    messages: [
      {
        role: 'system',
        content: `Você é um analisador visual de listas escolares em PDF (${passLabel}). Examine TODAS as páginas do documento, linha por linha da tabela de alunos. Para CADA linha que contém um nome de aluno, reporte exatamente o que você vê — NÃO classifique, NÃO interprete, apenas descreva.

Para cada aluno reporte:
- full_name: nome exato como aparece, preservando acentos e ortografia
- name_color: "black" (preto/cinza escuro normal) | "red" (texto em vermelho) | "other" (qualquer outra cor distinguível)
- has_strikethrough: true se houver linha horizontal cortando o nome (rachura/strikethrough), seja impressa ou manuscrita; false caso contrário
- situacao: conteúdo EXATO da coluna "Situação" (geralmente siglas como MTR, MTI, TRA, DES, REM). Se vazia, retorne "".
- situacao: conteúdo EXATO da coluna "Situação" (geralmente siglas como MTR, MTI, CTI, CPG, TRA, DES, REM). Se vazia, retorne "".
- page: número da página onde o nome aparece (1-indexed)
- guardian_name, guardian_phone, birth_date: quando visíveis nas demais colunas
- confidence: 0.0 a 1.0 indicando clareza da leitura desse registro

REGRAS:
1. Examine TODAS as páginas. Nenhuma linha pode ser omitida.
2. Não invente nomes nem complete nomes parciais.
3. Ignore cabeçalhos, números de ordem e rótulos.
4. Reporte cor e rachura observando o estilo visual REAL do PDF.`
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
                  confidence: { type: 'number' }
                },
                required: ['full_name', 'name_color', 'has_strikethrough', 'situacao']
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

    // ===== Dois passes INDEPENDENTES =====
    const [pass1, pass2] = await Promise.all([
      runExtractionPass(pdfBase64, 'Passe 1', LOVABLE_API_KEY),
      runExtractionPass(pdfBase64, 'Passe 2', LOVABLE_API_KEY),
    ]);

    if (!pass1.ok && !pass2.ok) {
      const status = pass1.status === 402 || pass2.status === 402 ? 402
        : pass1.status === 429 || pass2.status === 429 ? 429 : 500;
      const msg = status === 429 ? 'Limite de requisições excedido. Tente novamente mais tarde.'
        : status === 402 ? 'Créditos insuficientes. Adicione créditos à sua conta.'
        : 'Falha ao analisar o PDF. Estrutura desconhecida ou ilegível.';
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pagesRead = Math.max(pass1.pages, pass2.pages);
    console.log(`Pass1: ${pass1.rows.length} rows | Pass2: ${pass2.rows.length} rows | pages=${pagesRead}`);

    // Index pass2 by normalized name
    const p2Map = new Map<string, any>();
    for (const r of pass2.rows) {
      const k = normalizeName(r.full_name || '');
      if (k.length >= 2 && !p2Map.has(k)) p2Map.set(k, r);
    }

    // Use union of names from both passes as authoritative set
    const allKeys = new Set<string>();
    const p1Map = new Map<string, any>();
    for (const r of pass1.rows) {
      const k = normalizeName(r.full_name || '');
      if (k.length >= 2 && !p1Map.has(k)) { p1Map.set(k, r); allKeys.add(k); }
    }
    for (const k of p2Map.keys()) allKeys.add(k);

    const phoneRegex = /^\d{10,11}$/;
    const nameValid = (n: string) => /^[\p{L}\s'\-\.]+$/u.test(n) && n.trim().length >= 2;

    const active: any[] = [];
    const removed: any[] = [];
    const review: any[] = [];

    for (const k of allKeys) {
      const a = p1Map.get(k);
      const b = p2Map.get(k);
      const primary = a || b;
      const full_name = String(primary.full_name || '').trim().substring(0, 100);

      // Collect issues for divergence/quality
      const issues: string[] = [];
      if (!a) issues.push('Detectado apenas no Passe 2');
      if (!b) issues.push('Detectado apenas no Passe 1');
      if (!nameValid(full_name)) issues.push('Nome com caracteres suspeitos');

      const colorA = a?.name_color ?? null;
      const colorB = b?.name_color ?? null;
      const strikeA = a?.has_strikethrough ?? null;
      const strikeB = b?.has_strikethrough ?? null;
      const sitA = String(a?.situacao ?? '').trim().toUpperCase();
      const sitB = String(b?.situacao ?? '').trim().toUpperCase();
      const confA = typeof a?.confidence === 'number' ? a.confidence : 0.8;
      const confB = typeof b?.confidence === 'number' ? b.confidence : 0.8;

      if (a && b) {
        if (colorA !== colorB) issues.push(`Divergência de cor (${colorA} vs ${colorB})`);
        if (strikeA !== strikeB) issues.push(`Divergência de rachura (${strikeA} vs ${strikeB})`);
        if (sitA !== sitB) issues.push(`Divergência de situação (${sitA || '—'} vs ${sitB || '—'})`);
      }
      if (confA < 0.7 || confB < 0.7) issues.push('Baixa confiança de leitura');

      // Determine consolidated signals (only when both agree, otherwise mark review)
      const color = colorA && colorB && colorA === colorB ? colorA : (colorA || colorB);
      const strike = (strikeA === strikeB) ? strikeA : (strikeA ?? strikeB);
      const situacao = (sitA && sitB && sitA === sitB) ? sitA : (sitA || sitB);

      const rawPhone = String(primary.guardian_phone || '').replace(/\D/g, '');
      const base = {
        full_name,
        page: primary.page ?? null,
        name_color: color,
        has_strikethrough: !!strike,
        situacao,
        birth_date: primary.birth_date || null,
        guardian_name: String(primary.guardian_name || '').substring(0, 100),
        guardian_phone: phoneRegex.test(rawPhone) ? rawPhone : '',
        confidence: Math.min(confA, confB || confA),
        class: className.substring(0, 100),
        shift: shift || 'morning',
      };

      const isRemovedBySituation = VALID_REMOVED_SITUATIONS.includes(situacao);
      const isRemoved = color === 'red' || strike === true || isRemovedBySituation;
      const isActive = color === 'black' && strike === false && VALID_ACTIVE_SITUATIONS.includes(situacao);

      if (issues.length > 0) {
        review.push({ ...base, reasons: issues, suggested: isRemoved ? 'removed' : (isActive ? 'active' : 'unknown') });
      } else if (isRemoved) {
        const reason = color === 'red' && strike ? 'both'
          : color === 'red' ? 'red'
          : strike ? 'strike'
          : 'strike'; // situação CTI/CPG — reaproveita rótulo existente do frontend
        removed.push({ ...base, reason });
      } else if (isActive) {
        active.push(base);
      } else {
        // Cor preta, sem rachura, mas situação fora de MTR/MTI → revisão
        const why = !situacao ? 'Situação ausente' : `Situação "${situacao}" não reconhecida`;
        review.push({ ...base, reasons: [why], suggested: 'unknown' });
      }
    }

    const stats = {
      pages: pagesRead,
      total: allKeys.size,
      active: active.length,
      removed: removed.length,
      review: review.length,
      pass1_rows: pass1.rows.length,
      pass2_rows: pass2.rows.length,
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
