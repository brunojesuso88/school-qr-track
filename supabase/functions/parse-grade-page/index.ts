import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Importação de boletim PÁGINA A PÁGINA.
 *   action=create -> guarda o PDF na sessão, conta as páginas e cria as linhas de página
 *   action=page   -> recorta SOMENTE a página pedida, envia à IA e devolve a prévia (nada é gravado no acadêmico)
 *   action=status -> devolve o estado da sessão e das páginas
 * Nenhuma chamada envia o PDF inteiro à IA, então não há risco de timeout por volume.
 */

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
/** Leitura normal: Flash (rápido). Pro só entra como 2ª leitura em caso de dúvida. */
const FAST_MODEL = 'google/gemini-2.5-flash';
const ESCALATION_MODEL = 'google/gemini-2.5-pro';
const FAST_TIMEOUT_MS = 45_000;
const ESCALATION_TIMEOUT_MS = 70_000;
/** Limiar de confiança abaixo do qual a página é reencaminhada ao modelo Pro. */
const CONFIDENCE_ESCALATION_THRESHOLD = 0.85;

interface ClassStudent {
  id: string;
  full_name: string;
  student_id?: string | null;
  school_code?: string | null;
  birth_date?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
}

const normalize = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9º°ª\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  const inter = at.filter((t) => bt.includes(t)).length;
  const tokenScore = (2 * inter) / (at.length + bt.length);
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return Math.min(1, tokenScore + (longer.includes(shorter) ? 0.15 : 0));
}

function parseGradeValue(raw: string | null | undefined): { value: number | null; invalid: boolean } {
  if (raw == null) return { value: null, invalid: false };
  const text = String(raw).trim();
  if (!text || ['-', '--', '—', 'n/a', 'na', 'nc', '*'].includes(text.toLowerCase())) {
    return { value: null, invalid: false };
  }
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return { value: null, invalid: true };
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return { value: null, invalid: true };
  return { value: num, invalid: false };
}

const isAbsenceLabel = (label: string) => /falta/.test(normalize(label));

function classifyPeriod(label: string, hinted?: string | null): { kind: string; canonical: string } {
  const norm = normalize(label);
  const periodMatch = norm.match(/^([1-4])\s*(º|o|a|ª)?\s*(periodo|bimestre|etapa|trimestre)/);
  if (periodMatch) return { kind: 'period', canonical: `${periodMatch[1]}º Período` };
  if (/^(media|média)\s*final$/.test(norm)) return { kind: 'media_final', canonical: 'Média Final' };
  if (/^rec\.?\s*final$/.test(norm)) return { kind: 'rec_final', canonical: 'Rec. Final' };
  if (/^cons\.?\s*class/.test(norm)) return { kind: 'cons_class', canonical: 'Cons. Class' };
  if (/^pendencia$/.test(norm)) return { kind: 'pendencia', canonical: 'Pendência' };
  if (/^final$/.test(norm)) return { kind: 'final', canonical: 'Final' };
  if (hinted === 'final' || /final/.test(norm)) return { kind: 'final', canonical: label };
  return { kind: 'unknown', canonical: label };
}

const PERIOD_ORDER = ['1º período', '2º período', '3º período', '4º período', 'media final', 'rec final', 'cons class', 'pendencia', 'final'];
const periodRank = (label: string) => {
  const idx = PERIOD_ORDER.indexOf(normalize(label));
  return idx === -1 ? PERIOD_ORDER.length : idx;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

/** Recorta uma única página (1-based) do PDF. */
async function extractSinglePage(pdfBytes: Uint8Array, pageNumber: number): Promise<{ base64: string; total: number } | null> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (pageNumber < 1 || pageNumber > total) return null;
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(src, [pageNumber - 1]);
  out.addPage(copied);
  return { base64: bytesToBase64(await out.save()), total };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractJson(content: string): any {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : content;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Resposta da IA não contém JSON');
  return JSON.parse(text.slice(start, end + 1));
}

const SYSTEM_PROMPT = `Você extrai NOTAS de UMA ÚNICA PÁGINA de BOLETIM ESCOLAR (padrão SIAEP/SEDUC) em PDF, com precisão absoluta.

ESTRUTURA DA PÁGINA:
- A página corresponde a UM aluno. O cabeçalho traz Aluno(a), Código, Data de Nascimento, Mãe, Pai, Escola e Turma.
- Cada linha da grade é uma DISCIPLINA. As colunas são 1º Período, 2º Período, 3º Período, 4º Período e colunas finais (Média Final, Rec. Final, Cons. Class, Pendência, Final).
- Dentro de cada período existem DUAS subcolunas: "Nota" e "Faltas".

REGRAS OBRIGATÓRIAS:
1. IGNORE COMPLETAMENTE a subcoluna FALTAS. Nunca reporte faltas nem confunda faltas com nota. A primeira subcoluna do período é a Nota; a segunda é Faltas (descartar).
2. Reporte UMA entrada por célula de NOTA: disciplina × período/etapa.
3. NUNCA invente valores. Célula vazia => note_raw = null ("sem nota informada").
4. "0,00" (ou 0 / 0,0) escrito na célula é NOTA REAL zero e deve vir como "0,00". VAZIO NUNCA é zero.
5. Preserve o valor exatamente como aparece (vírgula decimal). Não arredonde nem recalcule médias.
6. DESCUBRA as disciplinas lendo as linhas DESTA página. Não assuma disciplinas de outras páginas.
7. Use period exatamente "1º Período", "2º Período", "3º Período", "4º Período", "Média Final", "Rec. Final", "Cons. Class", "Pendência" ou "Final".
8. Extraia os dados cadastrais do cabeçalho: Código (sem remover zeros à esquerda), Data de Nascimento (ISO AAAA-MM-DD), Mãe, Pai e Turma. Campo ausente => null. NUNCA invente.
9. confidence entre 0 e 1 por célula (baixo quando o dígito estiver borrado/cortado ou a coluna ambígua).
10. VERIFICAÇÃO LINHA A LINHA: percorra UMA disciplina por vez, da esquerda para a direita, e confira o alinhamento
    vertical do valor com o SUBCABEÇALHO "Nota" daquele período antes de reportar. Se o valor não estiver claramente
    sob a subcoluna "Nota" da linha em questão, reporte note_raw = null e registre a dúvida em "notes".
11. É PREFERÍVEL reportar null a arriscar um palpite: nunca deslize um valor de outra linha, de outra coluna ou da
    subcoluna Faltas para preencher uma célula vazia.

Responda SOMENTE com JSON válido:
{
  "student": {"name": "NOME", "student_code": "26.123.456", "birth_date": "2009-03-14", "mother_name": "MAE", "father_name": "PAI", "class_code": "26RMM100"},
  "periods": [{"label": "1º Período", "kind": "period"}],
  "subjects": ["ARTE", "BIOLOGIA"],
  "rows": [{"subject": "ARTE", "period": "1º Período", "note_raw": "3,17", "confidence": 0.98}],
  "notes": ["observações sobre células ambíguas ou página sem aluno"]
}`;

async function callGateway(model: string, body: unknown, apiKey: string, timeoutMs: number) {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as Record<string, unknown>), model }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

interface ReadOutcome {
  parsed: any | null;
  model: string;
  status: number;
  /** 'ok' | 'http' | 'timeout' | 'network' | 'bad_json' */
  failure: 'ok' | 'http' | 'timeout' | 'network' | 'bad_json';
}

/** Uma única leitura da página com o modelo indicado. Sem loops. */
async function readOnce(model: string, body: unknown, apiKey: string, timeoutMs: number): Promise<ReadOutcome> {
  try {
    const res = await callGateway(model, body, apiKey, timeoutMs);
    if (!res.ok) {
      await res.text().catch(() => '');
      return { parsed: null, model, status: res.status, failure: 'http' };
    }
    const aiJson = await res.json();
    const content = String(aiJson?.choices?.[0]?.message?.content ?? '');
    try {
      return { parsed: extractJson(content), model, status: 200, failure: 'ok' };
    } catch (_e) {
      return { parsed: null, model, status: 200, failure: 'bad_json' };
    }
  } catch (e) {
    const timedOut = e instanceof Error && /timeout|abort/i.test(e.message);
    console.error(`Leitura com ${model} falhou:`, e);
    return { parsed: null, model, status: 0, failure: timedOut ? 'timeout' : 'network' };
  }
}

/**
 * Validações determinísticas locais sobre a leitura rápida.
 * Retorna os motivos que justificam uma 2ª leitura com o modelo Pro.
 */
function suspicionReasons(parsed: any, expectedSubjectCount: number): string[] {
  const reasons: string[] = [];
  if (!parsed || typeof parsed !== 'object') return ['json_incompleto'];

  const header = parsed.student ?? {};
  const rows: any[] = Array.isArray(parsed.rows) ? parsed.rows : [];

  if (!String(header.name ?? '').trim()) reasons.push('aluno_nao_identificado');
  if (!String(header.class_code ?? '').trim()) reasons.push('turma_ausente');
  if (!Array.isArray(parsed.rows)) reasons.push('json_incompleto');
  if (rows.length === 0) reasons.push('nenhuma_linha_lida');

  const seen = new Map<string, string | null>();
  let lowConfidence = 0;

  for (const r of rows) {
    const subject = String(r?.subject ?? '').trim();
    const periodLabel = String(r?.period ?? '').trim();
    if (!subject) reasons.push('disciplina_ambigua');
    if (!periodLabel) reasons.push('periodo_ambiguo');
    if (isAbsenceLabel(subject) || isAbsenceLabel(periodLabel)) reasons.push('coluna_faltas_lida');
    if (periodLabel && classifyPeriod(periodLabel, r?.period_kind ?? null).kind === 'unknown') {
      reasons.push('periodo_invalido');
    }

    const raw = r?.note_raw ?? r?.raw_value ?? null;
    const rawText = raw == null ? null : String(raw).trim() || null;
    const { value, invalid } = parseGradeValue(rawText);
    if (invalid) reasons.push('nota_invalida');
    if (value != null && (value < 0 || value > 10)) reasons.push('nota_fora_da_escala');

    const conf = typeof r?.confidence === 'number' ? r.confidence : null;
    if (conf != null && conf < CONFIDENCE_ESCALATION_THRESHOLD) lowConfidence++;

    const key = `${normalize(subject)}||${normalize(periodLabel)}`;
    if (seen.has(key)) {
      if (seen.get(key) !== rawText) reasons.push('duplicidade_conflitante');
    } else {
      seen.set(key, rawText);
    }
  }

  if (lowConfidence > 0) reasons.push('baixa_confianca');

  const subjectsRead = new Set(rows.map((r) => normalize(r?.subject ?? '')).filter(Boolean)).size;
  if (expectedSubjectCount > 0 && subjectsRead > 0 && subjectsRead < Math.ceil(expectedSubjectCount * 0.5)) {
    reasons.push('linhas_insuficientes');
  }

  return [...new Set(reasons)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction']);
    if (auth instanceof Response) return auth;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? 'page');

    if (action === 'create') {
      const pdfBase64: string = payload.pdfBase64 ?? '';
      if (!pdfBase64) return json({ success: false, error: 'PDF não enviado.' }, 400);
      const bytes = base64ToBytes(pdfBase64);
      if (bytes.length > MAX_PDF_SIZE_BYTES) return json({ success: false, error: 'PDF acima do limite de 15MB.' }, 400);

      let totalPages = 0;
      try {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        totalPages = doc.getPageCount();
      } catch (_e) {
        return json({ success: false, error: 'Não foi possível ler o PDF (arquivo inválido ou protegido).' }, 400);
      }
      if (totalPages < 1) return json({ success: false, error: 'PDF sem páginas.' }, 400);

      const { data: session, error } = await admin
        .from('grade_import_sessions')
        .insert({
          class_id: payload.class_id,
          file_name: payload.fileName ?? null,
          total_pages: totalPages,
          current_page: 1,
          status: 'processing_page',
          pdf_base64: pdfBase64,
          context: {
            class_code: payload.class_code ?? null,
            students: payload.students ?? [],
            expected_subjects: payload.expected_subjects ?? [],
          },
          created_by: auth.userId,
        })
        .select('id, total_pages, current_page, status')
        .single();
      if (error) throw error;

      const pageRows = Array.from({ length: totalPages }, (_, i) => ({
        session_id: session.id,
        page_number: i + 1,
        status: 'pending',
      }));
      for (let i = 0; i < pageRows.length; i += 200) {
        const { error: pErr } = await admin.from('grade_import_session_pages').insert(pageRows.slice(i, i + 200));
        if (pErr) throw pErr;
      }

      return json({ success: true, session_id: session.id, total_pages: totalPages, current_page: 1 });
    }

    if (action === 'status') {
      const { data: session, error } = await admin
        .from('grade_import_sessions')
        .select('id, class_id, file_name, total_pages, current_page, status, confirmed_pages, ignored_pages, notes_imported, current_preview, context, created_at')
        .eq('id', payload.session_id)
        .maybeSingle();
      if (error) throw error;
      if (!session) return json({ success: false, error: 'Sessão não encontrada.' }, 404);
      const { data: pages } = await admin
        .from('grade_import_session_pages')
        .select('page_number, status, error')
        .eq('session_id', session.id)
        .order('page_number');
      return json({ success: true, session, pages: pages ?? [] });
    }

    if (action === 'cancel') {
      await admin
        .from('grade_import_sessions')
        .update({ status: 'cancelled', pdf_base64: null })
        .eq('id', payload.session_id);
      return json({ success: true });
    }

    if (action !== 'page') return json({ success: false, error: 'Ação inválida.' }, 400);

    // ---------- action=page: processa SOMENTE uma página ----------
    const sessionId = payload.session_id;
    const { data: session, error: sErr } = await admin
      .from('grade_import_sessions')
      .select('id, class_id, file_name, total_pages, status, context, pdf_base64')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) return json({ success: false, error: 'Sessão não encontrada.' }, 404);
    if (!session.pdf_base64) return json({ success: false, error: 'O arquivo desta sessão não está mais disponível. Inicie uma nova importação.' }, 410);

    const pageNumber = Number(payload.page_number ?? 1);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > session.total_pages) {
      return json({ success: false, error: 'Página fora do intervalo.' }, 400);
    }

    await admin.from('grade_import_sessions')
      .update({ current_page: pageNumber, status: 'processing_page' })
      .eq('id', session.id);
    await admin.from('grade_import_session_pages')
      .update({ status: 'processing', error: null })
      .eq('session_id', session.id).eq('page_number', pageNumber);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ success: false, error: 'LOVABLE_API_KEY não configurada.' }, 500);

    const context = (session.context ?? {}) as {
      class_code?: string | null;
      students?: ClassStudent[];
      expected_subjects?: { name: string; weekly_classes?: number | null }[];
    };
    const students = context.students ?? [];
    const expected = context.expected_subjects ?? [];

    const single = await extractSinglePage(base64ToBytes(session.pdf_base64), pageNumber);
    if (!single) return json({ success: false, error: 'Não foi possível isolar esta página do PDF.' }, 400);

    // Prompt enxuto: nada de lista de alunos nem de disciplinas da turma.
    // O casamento de aluno e disciplina é feito localmente depois da extração.
    const body = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Esta é a página ${pageNumber} do boletim. Extraia SOMENTE as notas desta página e os dados do cabeçalho (aluno, código, nascimento, mãe, pai, turma). Ignore a coluna Faltas.` },
            { type: 'file', file: { filename: `pagina-${pageNumber}.pdf`, file_data: `data:application/pdf;base64,${single.base64}` } },
          ],
        },
      ],
      temperature: 0,
    };

    const failPage = async (message: string) => {
      await admin.from('grade_import_session_pages')
        .update({ status: 'error', error: message })
        .eq('session_id', session.id).eq('page_number', pageNumber);
      return json({ success: false, error: message }, 200);
    };

    // 1ª leitura: Flash.
    let outcome = await readOnce(FAST_MODEL, body, apiKey, FAST_TIMEOUT_MS);

    // 429: no máximo 1 retry curto no próprio Flash. 402: sem retry.
    if (outcome.failure === 'http' && outcome.status === 429) {
      await sleep(1_200);
      outcome = await readOnce(FAST_MODEL, body, apiKey, FAST_TIMEOUT_MS);
      if (outcome.failure === 'http' && outcome.status === 429) {
        return await failPage('Limite de uso da IA atingido. Aguarde alguns instantes e leia esta página novamente.');
      }
    }
    if (outcome.failure === 'http' && outcome.status === 402) {
      return await failPage('Créditos de IA insuficientes para ler esta página.');
    }

    let reasons: string[] = [];
    let escalated = false;

    const transientFailure = outcome.failure === 'timeout' || outcome.failure === 'network' ||
      outcome.failure === 'bad_json' || (outcome.failure === 'http' && outcome.status >= 500);

    if (outcome.failure === 'ok') {
      reasons = suspicionReasons(outcome.parsed, expected.length);
    }

    // 2ª leitura com Pro SOMENTE em erro transitório relevante ou sinais de dúvida. Nunca em loop.
    if (transientFailure || (outcome.failure === 'ok' && reasons.length > 0)) {
      const second = await readOnce(ESCALATION_MODEL, body, apiKey, ESCALATION_TIMEOUT_MS);
      if (second.failure === 'ok') {
        const secondReasons = suspicionReasons(second.parsed, expected.length);
        // Mantém a leitura com menos problemas detectados.
        if (outcome.failure !== 'ok' || secondReasons.length <= reasons.length) {
          outcome = second;
          reasons = secondReasons;
        }
        escalated = true;
      } else if (outcome.failure !== 'ok') {
        const message = second.failure === 'timeout'
          ? `A leitura da página ${pageNumber} demorou demais. Tente ler esta página novamente.`
          : second.status === 402
            ? 'Créditos de IA insuficientes para ler esta página.'
            : `Falha ao ler a página ${pageNumber}. Tente novamente.`;
        return await failPage(message);
      }
    }

    if (outcome.failure !== 'ok' || !outcome.parsed) {
      return await failPage(`Não foi possível interpretar a leitura da página ${pageNumber}.`);
    }

    const parsed = outcome.parsed;

    // ---------- Normalização da prévia ----------
    const header = parsed.student ?? {};
    const pdfName = String(header.name ?? '').trim();

    // Períodos desta página (Faltas e colunas finais descartadas)
    const periodMap = new Map<string, { label: string; normalized_label: string; kind: string; sort_order: number }>();
    const registerPeriod = (label: string, hinted?: string | null) => {
      if (!label || isAbsenceLabel(label)) return null;
      const { kind, canonical } = classifyPeriod(label, hinted);
      // Média Final, Rec. Final, Cons. Class, Pendência e Final nunca são notas de período.
      if (kind !== 'period') return null;
      const norm = normalize(canonical);
      if (!periodMap.has(norm)) {
        periodMap.set(norm, { label: canonical, normalized_label: norm, kind, sort_order: periodRank(canonical) });
      }
      return periodMap.get(norm)!;
    };
    (parsed.periods ?? []).forEach((p: { label?: string; kind?: string }) => registerPeriod(String(p?.label ?? ''), p?.kind ?? null));

    const subjectMap = new Map<string, { name: string; normalized_name: string; sort_order: number; weekly_classes: number | null; matched_expected: string | null }>();
    const registerSubject = (name: string) => {
      const clean = String(name ?? '').trim();
      if (!clean) return null;
      const norm = normalize(clean);
      if (!subjectMap.has(norm)) {
        let matched: string | null = null;
        let best = 0;
        for (const e of expected) {
          const score = similarity(norm, normalize(e.name));
          if (score > best) { best = score; matched = e.name; }
        }
        const exp = best >= 0.7 ? expected.find((e) => e.name === matched) : undefined;
        subjectMap.set(norm, {
          name: clean,
          normalized_name: norm,
          sort_order: subjectMap.size,
          weekly_classes: exp?.weekly_classes ?? null,
          matched_expected: exp ? matched : null,
        });
      }
      return subjectMap.get(norm)!;
    };
    (parsed.subjects ?? []).forEach((s: string) => registerSubject(s));

    // Casamento do aluno
    // Mesmas camadas do motor local (src/lib/gradePageLocal/studentMatch.ts):
    // código (dígitos) único -> nome normalizado exato único -> semelhança >= 0.85 com candidato único.
    // Dois ou mais candidatos plausíveis => ambiguidade (nunca vincula automaticamente).
    const digitsOnly = (v: unknown) => {
      const d = String(v ?? '').replace(/\D+/g, '');
      if (!d) return '';
      return d.replace(/^0+/, '') || '0';
    };
    // Código do boletim COMPLETO (todos os dígitos, zeros à esquerda preservados).
    const fullCode = (v: unknown) => {
      const raw = String(v ?? '').replace(/[\u200b-\u200d\u2060\ufeff]/g, ' ');
      const m = raw.match(/\d(?:[\d.,\-/]|[ ](?=\d))*\d|\d/);
      const digits = m ? m[0].replace(/\D+/g, '') : '';
      return digits || null;
    };
    const pdfCodeFull = fullCode(header.student_code);
    const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'du']);
    const tokensOf = (v: unknown) =>
      normalize(String(v ?? '')).split(' ').filter((t) => t && !PARTICLES.has(t));
    const tokenSim = (a: unknown, b: unknown) => {
      const sa = new Set(tokensOf(a));
      const sb = new Set(tokensOf(b));
      if (sa.size === 0 || sb.size === 0) return 0;
      let inter = 0;
      sa.forEach((t) => { if (sb.has(t)) inter++; });
      return (2 * inter) / (sa.size + sb.size);
    };
    const sameName = (a: unknown, b: unknown) => {
      const ta = tokensOf(a);
      const tb = tokensOf(b);
      if (ta.length === 0 || tb.length === 0) return false;
      if (normalize(String(a ?? '')) === normalize(String(b ?? ''))) return true;
      if (ta.length !== tb.length) return false;
      return [...ta].sort().join(' ') === [...tb].sort().join(' ');
    };

    let matchedStudent: ClassStudent | null = null;
    let matchScore = 0;
    let ambiguous = false;
    let status: 'matched' | 'fuzzy' | 'unmatched' = 'unmatched';

    const pdfCode = digitsOnly(header.student_code);
    const byCode = pdfCode ? students.filter((s) => digitsOnly(s.school_code) === pdfCode) : [];
    const byName = students.filter((s) => sameName(pdfName, s.full_name));

    if (byCode.length === 1) {
      matchedStudent = byCode[0]; matchScore = 1; status = 'matched';
    } else if (byName.length === 1) {
      matchedStudent = byName[0]; matchScore = 1; status = 'matched';
    } else if (byName.length > 1) {
      // Código repetido na turma não trava o casamento; só desempata se isolar um homônimo.
      const intersect = byName.filter((s) => byCode.some((c) => c.id === s.id));
      if (intersect.length === 1) {
        matchedStudent = intersect[0]; matchScore = 1; status = 'matched';
      } else {
        matchScore = 1; ambiguous = true;
      }
    } else {
      const scored = students
        .map((s) => ({ s, score: tokenSim(pdfName, s.full_name) }))
        .filter((e) => e.score >= 0.85)
        .sort((a, b) => b.score - a.score);
      if (scored.length === 1) {
        matchedStudent = scored[0].s; matchScore = scored[0].score; status = 'fuzzy';
      } else if (scored.length > 1) {
        matchScore = scored[0].score; ambiguous = true;
      } else {
        matchScore = students.reduce((acc, s) => Math.max(acc, tokenSim(pdfName, s.full_name)), 0);
      }
    }
    const linkedStudent = status === 'unmatched' ? null : matchedStudent;

    const rows = (parsed.rows ?? []).flatMap((r: any) => {
      const subject = registerSubject(r?.subject);
      const period = registerPeriod(String(r?.period ?? ''), r?.period_kind ?? null);
      if (!subject || !period) return [];
      const raw = r?.note_raw ?? r?.raw_value ?? null;
      const rawText = raw == null ? null : String(raw).trim() || null;
      const { value, invalid } = parseGradeValue(rawText);
      const confidence = typeof r?.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : null;
      const flags: string[] = [];
      if (invalid) flags.push('invalid_value');
      if (!invalid && value == null) flags.push('empty_cell');
      if (value === 0) flags.push('explicit_zero');
      if (value != null && (value < 0 || value > 10)) flags.push('out_of_scale');
      if (confidence != null && confidence < 0.7) flags.push('low_confidence');
      if (status === 'fuzzy') flags.push('fuzzy_student_match');
      if (status === 'unmatched') flags.push('unmatched_student');
      if (escalated && (invalid || (confidence != null && confidence < CONFIDENCE_ESCALATION_THRESHOLD))) {
        flags.push('second_reading');
      }
      return [{
        student_name: pdfName,
        student_code: pdfCodeFull,
        class_code: header.class_code ?? null,
        subject: subject.name,
        period: period.label,
        period_kind: period.kind,
        raw_value: rawText,
        note_raw: rawText,
        note_numeric: value,
        value,
        page: pageNumber,
        source_page: pageNumber,
        confidence,
        student_id: linkedStudent?.id ?? null,
        matched_name: linkedStudent?.full_name ?? null,
        match_score: matchScore,
        flags,
        source: 'import',
      }];
    });

    rows.sort((a: any, b: any) => {
      const bySubject = String(a.subject).localeCompare(String(b.subject), 'pt-BR');
      if (bySubject !== 0) return bySubject;
      return periodRank(a.period) - periodRank(b.period);
    });

    const conflicts: string[] = [];
    if (ambiguous) conflicts.push('ambiguous_match');
    if (status === 'unmatched' && !ambiguous) conflicts.push('not_in_class');
    if (status === 'fuzzy') conflicts.push('name_similar');
    if (linkedStudent) {
      const same = (a?: string | null, b?: string | null) =>
        (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
      if (pdfCodeFull && linkedStudent.school_code && digitsOnly(pdfCodeFull) !== digitsOnly(linkedStudent.school_code)) conflicts.push('code_mismatch');
      if (header.birth_date && linkedStudent.birth_date && header.birth_date !== linkedStudent.birth_date) conflicts.push('birth_date_mismatch');
      if (header.mother_name && linkedStudent.mother_name && !same(header.mother_name, linkedStudent.mother_name)) conflicts.push('mother_mismatch');
      if (header.father_name && linkedStudent.father_name && !same(header.father_name, linkedStudent.father_name)) conflicts.push('father_mismatch');
    }

    const cells = rows.length;
    const preview = {
      page: pageNumber,
      total_pages: session.total_pages,
      pdf_class_code: header.class_code ?? null,
      student: {
        pdf_name: pdfName,
        pdf_code: pdfCodeFull,
        pdf_birth_date: header.birth_date ?? null,
        pdf_mother_name: header.mother_name ?? null,
        pdf_father_name: header.father_name ?? null,
      },
      detected: {
        key: normalize(pdfName) || `pagina-${pageNumber}`,
        pdf_name: pdfName,
        pdf_code: pdfCodeFull,
        pdf_birth_date: header.birth_date ?? null,
        pdf_mother_name: header.mother_name ?? null,
        pdf_father_name: header.father_name ?? null,
        pages: [pageNumber],
        cells,
        student_id: linkedStudent?.id ?? null,
        matched_name: linkedStudent?.full_name ?? null,
        match_score: matchScore,
        status,
        conflicts,
        current: linkedStudent
          ? {
            school_code: linkedStudent.school_code ?? null,
            birth_date: linkedStudent.birth_date ?? null,
            mother_name: linkedStudent.mother_name ?? null,
            father_name: linkedStudent.father_name ?? null,
            student_id: linkedStudent.student_id ?? null,
          }
          : null,
      },
      subjects: [...subjectMap.values()],
      periods: [...periodMap.values()].sort((a, b) => a.sort_order - b.sort_order),
      rows,
      stats: {
        cells_total: cells,
        grades_read: rows.filter((r: any) => r.value != null).length,
        empty_cells: rows.filter((r: any) => r.value == null && !r.flags.includes('invalid_value')).length,
        explicit_zero_cells: rows.filter((r: any) => r.value === 0).length,
        invalid_values: rows.filter((r: any) => r.flags.includes('invalid_value')).length,
        low_confidence: rows.filter((r: any) => r.flags.includes('low_confidence')).length,
        subjects: subjectMap.size,
        periods: periodMap.size,
      },
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 10) : [],
      reading: {
        mode: escalated ? 'validated' : 'fast',
        escalated,
        reasons,
      },
    };

    await admin.from('grade_import_session_pages')
      .update({ status: 'awaiting_confirmation', preview_json: preview, error: null })
      .eq('session_id', session.id).eq('page_number', pageNumber);
    await admin.from('grade_import_sessions')
      .update({ status: 'awaiting_confirmation', current_preview: preview, current_page: pageNumber })
      .eq('id', session.id);

    return json({ success: true, preview });
  } catch (e) {
    console.error('parse-grade-page:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500);
  }
});