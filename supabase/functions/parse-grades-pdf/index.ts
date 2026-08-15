import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const PRIMARY_MODEL = 'google/gemini-2.5-pro';
const FALLBACK_MODEL = 'google/gemini-2.5-flash';

interface ClassStudent {
  id: string;
  full_name: string;
  student_id?: string | null;
  school_code?: string | null;
  birth_date?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
}

interface ExpectedSubject {
  name: string;
  weekly_classes?: number | null;
}

interface ExtractedRow {
  student_name: string;
  subject: string;
  period: string;
  raw_value?: string | null;
  note_raw?: string | null;
  student_code?: string | null;
  class_code?: string | null;
  period_kind?: string | null;
  page?: number | null;
  confidence?: number | null;
}

interface ExtractionPayload {
  pages?: number | null;
  periods?: { label: string; kind?: string }[];
  subjects?: string[];
  students?: (string | {
    name?: string;
    student_code?: string | null;
    class_code?: string | null;
    page?: number | null;
    birth_date?: string | null;
    mother_name?: string | null;
    father_name?: string | null;
  })[];
  rows?: ExtractedRow[];
  notes?: string[];
}

interface ReviewRow extends Omit<ExtractedRow, 'raw_value' | 'note_raw'> {
  raw_value: string | null;
  note_raw: string | null;
  note_numeric: number | null;
  value: number | null;
  student_id: string | null;
  matched_name: string | null;
  match_score: number;
  flags: string[];
  second_pass_value?: string | null;
  source_page: number | null;
}

/** Períodos/etapas oficiais do boletim SIAEP e colunas finais. */
const FINAL_COLUMN_PATTERNS: { kind: string; label: string; test: RegExp }[] = [
  { kind: 'media_final', label: 'Média Final', test: /^(media|média)\s*final$/ },
  { kind: 'rec_final', label: 'Rec. Final', test: /^rec\.?\s*final$/ },
  { kind: 'cons_class', label: 'Cons. Class', test: /^cons\.?\s*class/ },
  { kind: 'pendencia', label: 'Pendência', test: /^pendencia$/ },
  { kind: 'final', label: 'Final', test: /^final$/ },
];

/** Detecta rótulos de coluna de FALTAS, que devem ser descartados por completo. */
const isAbsenceLabel = (label: string) => /falta/.test(normalize(label));

function classifyPeriod(label: string, hinted?: string | null): { kind: string; canonical: string } {
  const norm = normalize(label);
  const periodMatch = norm.match(/^([1-4])\s*(º|o|a|ª)?\s*(periodo|bimestre|etapa|trimestre)/);
  if (periodMatch) return { kind: 'period', canonical: `${periodMatch[1]}º Período` };
  for (const f of FINAL_COLUMN_PATTERNS) {
    if (f.test.test(norm)) return { kind: f.kind, canonical: f.label };
  }
  if (hinted === 'final') return { kind: 'final', canonical: label };
  if (/final/.test(norm)) return { kind: 'final', canonical: label };
  return { kind: 'unknown', canonical: label };
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
  // bônus para prefixo comum (nomes abreviados no boletim)
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  const contains = longer.includes(shorter) ? 0.15 : 0;
  return Math.min(1, tokenScore + contains);
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

async function callGateway(model: string, body: unknown, apiKey: string) {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as Record<string, unknown>), model }),
  });
}

async function callWithFallback(body: unknown, apiKey: string) {
  let res = await callGateway(PRIMARY_MODEL, body, apiKey);
  if (!res.ok && (res.status === 429 || res.status === 402 || res.status >= 500)) {
    console.warn(`Modelo primário falhou (${res.status}); usando ${FALLBACK_MODEL}`);
    res = await callGateway(FALLBACK_MODEL, body, apiKey);
  }
  return res;
}

function extractJson(content: string): any {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : content;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Resposta da IA não contém JSON');
  return JSON.parse(text.slice(start, end + 1));
}

const SYSTEM_PROMPT = `Você extrai NOTAS de BOLETINS ESCOLARES (padrão SIAEP/SEDUC) em PDF com precisão absoluta.

ESTRUTURA TÍPICA DO DOCUMENTO:
- UMA PÁGINA POR ALUNO. O cabeçalho da página traz Aluno(a), código do aluno, escola e Turma.
- Cada linha da grade é uma DISCIPLINA. As colunas são: 1º Período, 2º Período, 3º Período, 4º Período, Média Final, Rec. Final, Cons. Class, Pendência e Final.
- Dentro de cada período existem DUAS subcolunas: "Nota" e "Faltas".

REGRAS OBRIGATÓRIAS:
1. Analise TODAS as páginas, da primeira à última. Nenhuma página pode ser ignorada.
2. IGNORE COMPLETAMENTE a subcoluna FALTAS. Nunca reporte faltas, nunca confunda um valor de faltas com nota. Separe as células pela POSIÇÃO da coluna: a primeira subcoluna do período é a Nota, a segunda é Faltas (descartar).
3. Reporte UMA entrada por célula de NOTA: aluno × disciplina × período/etapa.
4. NUNCA invente valores. Célula vazia => note_raw = null (significa "sem nota informada").
5. "0,00" (ou 0, 0,0) escrito na célula é uma NOTA REAL igual a zero e deve ser reportado como note_raw "0,00". VAZIO NUNCA é zero e zero nunca é vazio.
6. Preserve o valor exatamente como aparece (com vírgula decimal). Não arredonde, não converta, não recalcule médias.
7. DESCUBRA as disciplinas dinamicamente lendo as linhas de cada página. NÃO assuma que a lista de disciplinas da primeira página vale para as outras: podem existir disciplinas preenchidas apenas em algumas páginas.
8. Reporte também as colunas finais quando houver valor: use period exatamente "Média Final", "Rec. Final", "Cons. Class", "Pendência" ou "Final".
9. Para cada linha informe student_name (exatamente como no PDF, com acentos), student_code (código/matrícula do cabeçalho quando existir), class_code (a Turma do cabeçalho) e page (1-based).
10. confidence entre 0 e 1 = sua certeza da leitura daquela célula (use valor baixo quando o dígito estiver borrado/cortado ou a coluna for ambígua).
11. Para CADA página/aluno, extraia também os DADOS CADASTRAIS do cabeçalho, quando existirem: "Código" (exatamente como aparece, sem remover zeros à esquerda), "Data de Nascimento" (formato ISO AAAA-MM-DD), "Mãe" e "Pai" (nomes completos). Se um campo não existir na página, use null. NUNCA invente nomes ou datas.

Responda SOMENTE com JSON válido no formato:
{
  "pages": number,
  "periods": [{"label": "1º Período", "kind": "period" | "final"}],
  "subjects": ["ARTE", "BIOLOGIA"],
  "students": [{"name": "NOME DO ALUNO", "student_code": "123456", "class_code": "26RMM100", "page": 1, "birth_date": "2009-03-14", "mother_name": "NOME DA MAE", "father_name": "NOME DO PAI"}],
  "rows": [{"student_name": "NOME", "student_code": "123456", "class_code": "26RMM100", "subject": "ARTE", "period": "1º Período", "note_raw": "3,17", "page": 1, "confidence": 0.98}],
  "notes": ["observações sobre cortes de linha, colunas ambíguas, páginas sem aluno"]
}`;

function buildExtractionBody(pdfBase64: string, fileName: string, expected: ExpectedSubject[], students: ClassStudent[]) {
  const subjectHint = expected.length
    ? `Disciplinas esperadas nesta turma (use-as apenas como referência de nomenclatura, não force o casamento): ${expected.map((s) => s.name).join(', ')}.`
    : '';
  const studentHint = students.length
    ? `Alunos matriculados nesta turma (referência de nomenclatura; podem existir alunos no PDF que não estão nesta lista): ${students.map((s) => s.full_name).join(' | ')}.`
    : '';
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Extraia todas as NOTAS deste boletim (uma página por aluno). Ignore a coluna Faltas.\n${subjectHint}\n${studentHint}` },
          { type: 'file', file: { filename: fileName || 'boletim.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` } },
        ],
      },
    ],
    temperature: 0,
  };
}

function buildReconciliationBody(pdfBase64: string, fileName: string, suspects: ReviewRow[]) {
  const list = suspects
    .slice(0, 120)
      .map((r) => `- aluno: ${r.student_name} | disciplina: ${r.subject} | período: ${r.period} | lido: ${r.note_raw ?? 'VAZIO'} | página: ${r.source_page ?? '?'}`)
    .join('\n');
  return {
    messages: [
      {
        role: 'system',
        content: `Você revisa células específicas de um boletim escolar (padrão SIAEP) em PDF. Releia SOMENTE as células de NOTA listadas (ignore a coluna Faltas) e confirme o valor exato na página indicada. Se a célula estiver realmente vazia, retorne note_raw null. "0,00" é nota zero válida, diferente de vazio. Nunca invente valores.
Responda SOMENTE com JSON: {"rows":[{"student_name":"...","subject":"...","period":"...","note_raw":"8,5"|null,"confidence":0.0}]}`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Confirme estas células suspeitas:\n${list}` },
          { type: 'file', file: { filename: fileName || 'boletim.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` } },
        ],
      },
    ],
    temperature: 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = await requireAuth(req, corsHeaders, ['admin', 'direction']);
    if (auth instanceof Response) return auth;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ success: false, error: 'IA não configurada no servidor' }, 500);

    const body = await req.json().catch(() => null);
    if (!body?.pdfBase64) return json({ success: false, error: 'PDF não enviado' }, 400);

    const pdfBase64: string = body.pdfBase64;
    const fileName: string = body.fileName || 'boletim.pdf';
    const students: ClassStudent[] = Array.isArray(body.students) ? body.students : [];
    const expected: ExpectedSubject[] = Array.isArray(body.expected_subjects) ? body.expected_subjects : [];
    const scaleMax: number = Number(body.scale_max) > 0 ? Number(body.scale_max) : 10;
    const expectedClassCode: string = String(body.class_code ?? body.class_name ?? '').trim();

    const approxBytes = Math.floor((pdfBase64.length * 3) / 4);
    if (approxBytes > MAX_PDF_SIZE_BYTES) {
      return json({ success: false, error: `PDF acima de ${MAX_PDF_SIZE_MB}MB` }, 413);
    }

    // ---------- Etapa 1: extração ----------
    const res = await callWithFallback(buildExtractionBody(pdfBase64, fileName, expected, students), apiKey);
    if (!res.ok) {
      const text = await res.text();
      console.error('Falha na extração:', res.status, text);
      if (res.status === 402) return json({ success: false, error: 'Créditos de IA insuficientes para processar o PDF.' }, 402);
      if (res.status === 429) return json({ success: false, error: 'Limite de uso da IA atingido. Tente novamente em instantes.' }, 429);
      return json({ success: false, error: 'Não foi possível ler o PDF.' }, 502);
    }
    const aiJson = await res.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? '';
    let payload: ExtractionPayload;
    try {
      payload = extractJson(content);
    } catch (e) {
      console.error('JSON inválido da IA:', e, content.slice(0, 500));
      return json({ success: false, error: 'A IA retornou um formato inesperado. Tente novamente.' }, 502);
    }

    const issues: { level: 'error' | 'warning' | 'info'; code: string; message: string }[] = [];
    const addIssue = (level: 'error' | 'warning' | 'info', code: string, message: string) =>
      issues.push({ level, code, message });

    (payload.notes || []).forEach((n) => addIssue('info', 'ai_note', String(n)));

    // ---------- Etapa 2: checagens determinísticas ----------
    const allRows = Array.isArray(payload.rows) ? payload.rows : [];
    // A coluna FALTAS é descartada por completo (requisito do usuário).
    const rawRows = allRows.filter((r) => !isAbsenceLabel(String(r?.period ?? '')) && !isAbsenceLabel(String(r?.subject ?? '')));
    const droppedAbsenceCells = allRows.length - rawRows.length;
    if (droppedAbsenceCells > 0) {
      addIssue('info', 'absences_ignored', `${droppedAbsenceCells} célula(s) de faltas foram descartadas — o módulo de notas ignora faltas.`);
    }
    if (rawRows.length === 0) {
      return json({ success: false, error: 'Nenhuma nota foi encontrada no PDF. Verifique se o arquivo é um boletim tabular.' }, 422);
    }

    const studentIndex = students.map((s) => ({ ...s, norm: normalize(s.full_name) }));

    // períodos / etapas (rótulos canônicos: 1º–4º Período + colunas finais)
    const periodMap = new Map<string, { label: string; kind: string }>();
    const canonicalPeriod = new Map<string, string>(); // rótulo lido -> canônico
    const registerPeriod = (rawLabel: string, hinted?: string | null) => {
      const label = String(rawLabel ?? '').trim() || 'Sem período';
      if (isAbsenceLabel(label)) return null;
      const { kind, canonical } = classifyPeriod(label, hinted);
      canonicalPeriod.set(label, canonical);
      const norm = normalize(canonical);
      if (!periodMap.has(norm)) periodMap.set(norm, { label: canonical, kind });
      return canonical;
    };
    for (const p of payload.periods || []) registerPeriod(String(p?.label ?? ''), p?.kind ?? null);
    for (const r of rawRows) registerPeriod(String(r?.period ?? ''), r?.period_kind ?? null);

    // disciplinas
    const subjectMap = new Map<string, { name: string; weekly_classes: number | null; matched_expected: string | null }>();
    const expectedIndex = expected.map((e) => ({ ...e, norm: normalize(e.name) }));
    const registerSubject = (name: string) => {
      const clean = String(name ?? '').trim();
      if (!clean) return;
      const norm = normalize(clean);
      if (subjectMap.has(norm)) return;
      let best: { name: string; weekly_classes?: number | null } | null = null;
      let bestScore = 0;
      for (const e of expectedIndex) {
        const score = similarity(norm, e.norm);
        if (score > bestScore) { bestScore = score; best = e; }
      }
      const matched = bestScore >= 0.7 ? best : null;
      subjectMap.set(norm, {
        name: clean,
        weekly_classes: matched?.weekly_classes ?? null,
        matched_expected: matched?.name ?? null,
      });
    };
    (payload.subjects || []).forEach(registerSubject);
    rawRows.forEach((r) => registerSubject(r?.subject ?? ''));

    // duplicidade de disciplinas (nomes distintos que normalizam para nomes muito parecidos)
    const subjectEntries = [...subjectMap.entries()];
    for (let i = 0; i < subjectEntries.length; i++) {
      for (let j = i + 1; j < subjectEntries.length; j++) {
        if (similarity(subjectEntries[i][0], subjectEntries[j][0]) >= 0.9) {
          addIssue('warning', 'duplicate_subject', `Possível disciplina duplicada no PDF: "${subjectEntries[i][1].name}" e "${subjectEntries[j][1].name}".`);
        }
      }
    }

    // duplicidade de alunos no PDF
    const pdfStudentNames = new Map<string, string>();
    const pagesByStudent = new Map<string, Set<number>>();
    const studentsByPage = new Map<number, Set<string>>();
    const classCodes = new Map<string, number>();
    for (const r of rawRows) {
      const norm = normalize(r?.student_name ?? '');
      if (norm && !pdfStudentNames.has(norm)) pdfStudentNames.set(norm, String(r.student_name));
      const page = typeof r?.page === 'number' ? r.page : null;
      if (norm && page != null) {
        if (!pagesByStudent.has(norm)) pagesByStudent.set(norm, new Set());
        pagesByStudent.get(norm)!.add(page);
        if (!studentsByPage.has(page)) studentsByPage.set(page, new Set());
        studentsByPage.get(page)!.add(norm);
      }
      const code = String(r?.class_code ?? '').trim();
      if (code) classCodes.set(code, (classCodes.get(code) ?? 0) + 1);
    }
    const pdfStudentList = [...pdfStudentNames.entries()];
    for (let i = 0; i < pdfStudentList.length; i++) {
      for (let j = i + 1; j < pdfStudentList.length; j++) {
        if (similarity(pdfStudentList[i][0], pdfStudentList[j][0]) >= 0.92) {
          addIssue('warning', 'duplicate_student', `Possível aluno duplicado no PDF: "${pdfStudentList[i][1]}" e "${pdfStudentList[j][1]}".`);
        }
      }
    }

    // linhas de revisão
    const seenCells = new Map<string, number>();
    const reviewRows: ReviewRow[] = [];
    let emptyCells = 0;
    let invalidValues = 0;
    let explicitZeroCells = 0;
    let filledCells = 0;

    for (const r of rawRows) {
      const studentName = String(r?.student_name ?? '').trim();
      const subjectName = String(r?.subject ?? '').trim();
      const readPeriod = String(r?.period ?? '').trim() || 'Sem período';
      const periodLabel = canonicalPeriod.get(readPeriod) ?? readPeriod;
      const flags: string[] = [];
      const noteRaw = r?.note_raw != null ? String(r.note_raw) : (r?.raw_value != null ? String(r.raw_value) : null);

      const norm = normalize(studentName);
      let matched: (typeof studentIndex)[number] | null = null;
      let score = 0;
      for (const s of studentIndex) {
        const sc = similarity(norm, s.norm);
        if (sc > score) { score = sc; matched = s; }
      }
      const confident = score >= 0.85;
      if (!confident) flags.push('unmatched_student');
      else if (score < 0.97) flags.push('fuzzy_student_match');

      if (!subjectName) flags.push('missing_subject');
      const { value, invalid } = parseGradeValue(noteRaw);
      if (invalid) { flags.push('invalid_value'); invalidValues++; }
      if (!invalid && value == null) { flags.push('empty_cell'); emptyCells++; }
      if (value != null) {
        filledCells++;
        if (value === 0) { flags.push('explicit_zero'); explicitZeroCells++; }
      }
      if (value != null && (value < 0 || value > scaleMax)) flags.push('out_of_scale');

      const conf = typeof r?.confidence === 'number' ? r.confidence : null;
      if (conf != null && conf < 0.85) flags.push('low_confidence');

      const cellKey = `${norm}||${normalize(subjectName)}||${normalize(periodLabel)}`;
      const prev = seenCells.get(cellKey);
      if (prev != null) {
        flags.push('duplicate_cell');
        const prevRow = reviewRows[prev];
        if (prevRow && (prevRow.note_raw ?? null) !== noteRaw) {
          prevRow.flags.push('conflicting_duplicate');
          flags.push('conflicting_duplicate');
          addIssue('error', 'conflicting_duplicate', `Valores diferentes para a mesma célula (${studentName} / ${subjectName} / ${periodLabel}).`);
        }
      }

      const row: ReviewRow = {
        student_name: studentName,
        student_code: r?.student_code != null ? String(r.student_code) : null,
        class_code: r?.class_code != null ? String(r.class_code) : null,
        subject: subjectName,
        period: periodLabel,
        period_kind: periodMap.get(normalize(periodLabel))?.kind ?? 'unknown',
        raw_value: noteRaw,
        note_raw: noteRaw,
        note_numeric: value,
        page: typeof r?.page === 'number' ? r.page : null,
        source_page: typeof r?.page === 'number' ? r.page : null,
        confidence: conf,
        value,
        student_id: confident && matched ? matched.id : null,
        matched_name: confident && matched ? matched.full_name : null,
        match_score: Number(score.toFixed(3)),
        flags,
      };
      if (prev == null) seenCells.set(cellKey, reviewRows.length);
      reviewRows.push(row);
    }

    // páginas × alunos: o boletim SIAEP tem exatamente 1 aluno por página
    const declaredPages = typeof payload.pages === 'number' ? payload.pages : null;
    const pagesSeen = [...studentsByPage.keys()].sort((a, b) => a - b);
    const multiStudentPages = pagesSeen.filter((p) => (studentsByPage.get(p)?.size ?? 0) > 1);
    if (multiStudentPages.length > 0) {
      addIssue('error', 'multiple_students_per_page', `Páginas com mais de um aluno detectado (esperado 1 por página): ${multiStudentPages.slice(0, 10).join(', ')}.`);
    }
    const multiPageStudents = [...pagesByStudent.entries()].filter(([, pages]) => pages.size > 1);
    if (multiPageStudents.length > 0) {
      addIssue('warning', 'student_in_multiple_pages', `${multiPageStudents.length} aluno(s) apareceram em mais de uma página (possível duplicidade de página).`);
    }
    if (declaredPages != null) {
      const emptyPages = [];
      for (let p = 1; p <= declaredPages; p++) if (!studentsByPage.has(p)) emptyPages.push(p);
      if (emptyPages.length > 0) {
        addIssue('error', 'pages_without_student', `Páginas sem aluno identificado: ${emptyPages.slice(0, 15).join(', ')}${emptyPages.length > 15 ? '...' : ''}.`);
      }
      if (declaredPages !== pdfStudentNames.size) {
        addIssue('warning', 'pages_students_mismatch', `O PDF tem ${declaredPages} página(s) mas ${pdfStudentNames.size} aluno(s) distinto(s) foram detectados (esperado 1 aluno por página).`);
      }
    }

    // turma do cabeçalho
    const classCodeList = [...classCodes.keys()];
    if (expectedClassCode) {
      const divergent = classCodeList.filter((c) => normalize(c) !== normalize(expectedClassCode));
      if (divergent.length > 0) {
        addIssue('error', 'class_code_mismatch', `Turma divergente no cabeçalho do PDF: encontrado ${divergent.slice(0, 5).join(', ')}; esperado ${expectedClassCode}.`);
      }
    } else if (classCodeList.length > 1) {
      addIssue('warning', 'multiple_class_codes', `O PDF contém mais de uma turma no cabeçalho: ${classCodeList.slice(0, 5).join(', ')}.`);
    }

    // alunos da turma ausentes do PDF / alunos do PDF fora da turma
    const matchedStudentIds = new Set(reviewRows.map((r) => r.student_id).filter(Boolean) as string[]);
    const missingStudents = studentIndex.filter((s) => !matchedStudentIds.has(s.id));
    if (missingStudents.length > 0) {
      addIssue('warning', 'students_missing_in_pdf', `${missingStudents.length} aluno(s) da turma não foram encontrados no PDF: ${missingStudents.slice(0, 10).map((s) => s.full_name).join(', ')}${missingStudents.length > 10 ? '...' : ''}.`);
    }
    const unmatchedNames = [...new Set(reviewRows.filter((r) => !r.student_id).map((r) => r.student_name))];
    if (unmatchedNames.length > 0) {
      addIssue('error', 'unmatched_students', `${unmatchedNames.length} nome(s) do PDF não foram identificados na turma: ${unmatchedNames.slice(0, 10).join(', ')}${unmatchedNames.length > 10 ? '...' : ''}.`);
    }

    // disciplinas esperadas ausentes
    const foundExpected = new Set([...subjectMap.values()].map((s) => s.matched_expected).filter(Boolean) as string[]);
    const missingSubjects = expected.filter((e) => !foundExpected.has(e.name));
    if (missingSubjects.length > 0) {
      addIssue('warning', 'subjects_missing_in_pdf', `Disciplinas da turma não localizadas no boletim: ${missingSubjects.map((s) => s.name).join(', ')}.`);
    }

    // matriz de completude aluno × disciplina × período (células vazias são legítimas neste boletim)
    const matrixCells = pdfStudentNames.size * subjectMap.size * periodMap.size;
    if (matrixCells > 0) {
      addIssue('info', 'completeness_matrix', `Matriz aluno × disciplina × período: ${matrixCells} combinações possíveis; ${filledCells} com nota, ${emptyCells} sem nota informada, ${explicitZeroCells} com nota 0,00 explícita. Células vazias são normais neste boletim.`);
    }
    if (invalidValues > 0) addIssue('error', 'invalid_values', `${invalidValues} valor(es) não numérico(s) exigem correção manual.`);
    if (reviewRows.some((r) => r.flags.includes('out_of_scale'))) {
      addIssue('error', 'out_of_scale', `Existem notas fora da escala 0–${scaleMax}.`);
    }

    // ---------- Etapa 3: reconciliação de células suspeitas ----------
    const suspects = reviewRows.filter((r) =>
      r.flags.includes('low_confidence') || r.flags.includes('invalid_value') ||
      r.flags.includes('out_of_scale') || r.flags.includes('conflicting_duplicate'));

    let reconciled = 0;
    if (suspects.length > 0 && suspects.length <= 150) {
      try {
        const res2 = await callWithFallback(buildReconciliationBody(pdfBase64, fileName, suspects), apiKey);
        if (res2.ok) {
          const j2 = await res2.json();
          const payload2 = extractJson(j2?.choices?.[0]?.message?.content ?? '');
          const map2 = new Map<string, { raw_value: string | null; confidence: number | null }>();
          for (const r of payload2?.rows ?? []) {
            const key = `${normalize(r?.student_name)}||${normalize(r?.subject)}||${normalize(r?.period)}`;
            const note = r?.note_raw != null ? String(r.note_raw) : (r?.raw_value != null ? String(r.raw_value) : null);
            map2.set(key, {
              raw_value: note,
              confidence: typeof r?.confidence === 'number' ? r.confidence : null,
            });
          }
          for (const row of suspects) {
            const key = `${normalize(row.student_name)}||${normalize(row.subject)}||${normalize(row.period)}`;
            const second = map2.get(key);
            if (!second) continue;
            reconciled++;
            if ((second.raw_value ?? null) === (row.note_raw ?? null)) {
              row.flags = row.flags.filter((f) => f !== 'low_confidence');
              row.flags.push('reconciled_match');
            } else {
              row.flags.push('low_confidence', 'reconciliation_divergence');
              row.second_pass_value = second.raw_value;
              addIssue('error', 'reconciliation_divergence', `Divergência entre leituras (${row.student_name} / ${row.subject} / ${row.period}): "${row.raw_value ?? 'VAZIO'}" vs "${second.raw_value ?? 'VAZIO'}". Revise manualmente.`);
            }
          }
        } else {
          addIssue('warning', 'reconciliation_skipped', 'A segunda validação por IA não pôde ser executada; revise manualmente as células sinalizadas.');
        }
      } catch (e) {
        console.error('Reconciliação falhou:', e);
        addIssue('warning', 'reconciliation_skipped', 'A segunda validação por IA falhou; revise manualmente as células sinalizadas.');
      }
    } else if (suspects.length > 150) {
      addIssue('warning', 'reconciliation_skipped', 'Muitas células suspeitas para reconciliação automática; revise manualmente.');
    }

    // dedupe flags
    reviewRows.forEach((r) => { r.flags = [...new Set(r.flags)]; });

    const stats = {
      pages: declaredPages,
      students_detected: pdfStudentNames.size,
      students_matched: matchedStudentIds.size,
      students_unmatched: unmatchedNames.length,
      students_in_class: students.length,
      students_missing_in_pdf: missingStudents.length,
      subjects: subjectMap.size,
      periods: periodMap.size,
      grades_read: reviewRows.filter((r) => r.value != null).length,
      cells_total: reviewRows.length,
      low_confidence: reviewRows.filter((r) => r.flags.includes('low_confidence')).length,
      empty_cells: emptyCells,
      explicit_zero_cells: explicitZeroCells,
      absence_cells_ignored: droppedAbsenceCells,
      class_codes: classCodeList,
      invalid_values: invalidValues,
      reconciled_cells: reconciled,
      issues: issues.length,
      errors: issues.filter((i) => i.level === 'error').length,
      warnings: issues.filter((i) => i.level === 'warning').length,
    };

    return json({
      success: true,
      stats,
      issues,
      periods: [...periodMap.entries()].map(([norm, p], idx) => ({ normalized_label: norm, label: p.label, kind: p.kind, sort_order: idx })),
      subjects: [...subjectMap.entries()].map(([norm, s], idx) => ({ normalized_name: norm, name: s.name, weekly_classes: s.weekly_classes, matched_expected: s.matched_expected, sort_order: idx })),
      rows: reviewRows,
      students_missing_in_pdf: missingStudents.map((s) => ({ id: s.id, full_name: s.full_name })),
    });
  } catch (error) {
    console.error('parse-grades-pdf erro:', error);
    return json({ success: false, error: 'Erro interno ao processar o boletim.' }, 500);
  }
});