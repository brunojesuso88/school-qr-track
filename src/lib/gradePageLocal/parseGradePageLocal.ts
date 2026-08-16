/**
 * Leitura LOCAL de uma página de boletim: texto + coordenadas -> prévia no formato
 * consumido pelo diálogo de importação. Nenhuma IA, nenhuma gravação.
 */
import { buildCells, detectGrid, groupLines } from './layout';
import { extractHeader } from './header';
import { normalizeText, periodRank, similarity } from './normalize';
import { matchStudentInClass } from './studentMatch';
import { digitsOnly } from './studentMatch';
import { buildSubjectAnchors, matchSubjectAnchor } from './subjectAnchors';
import { isLocallyConfident, validateLocalPage } from './validate';
import {
  LocalContextStudent, LocalParseContext, LocalValidation, TextToken,
} from './types';

export interface LocalPagePreview {
  page: number;
  total_pages: number;
  pdf_class_code: string | null;
  student: {
    pdf_name: string;
    pdf_code: string | null;
    pdf_birth_date: string | null;
    pdf_mother_name: string | null;
    pdf_father_name: string | null;
  };
  detected: Record<string, unknown>;
  subjects: { normalized_name: string; name: string; weekly_classes: number | null; matched_expected: string | null; sort_order: number }[];
  periods: { normalized_label: string; label: string; kind: string; sort_order: number }[];
  rows: Record<string, unknown>[];
  stats: {
    cells_total: number;
    grades_read: number;
    empty_cells: number;
    explicit_zero_cells: number;
    invalid_values: number;
    low_confidence: number;
    subjects: number;
    periods: number;
  };
  notes: string[];
  reading: {
    mode: 'local' | 'local_validated' | 'ai_fallback' | 'fast' | 'validated';
    escalated: boolean;
    reasons: string[];
    local_score: number;
    divergences: number;
    absence_tokens_dropped: number;
    duration_ms?: number;
    /** Disciplinas reais reconhecidas por âncora curricular, sem notas lançadas. */
    anchored_subjects?: string[];
    /** Linhas de disciplina fundidas (nome quebrado em duas linhas). */
    merged_subject_lines?: number;
    /** Células vazias que só a IA listou e foram ignoradas (não são notas). */
    ai_empty_ignored?: number;
  };
}

export interface LocalParseResult {
  ok: boolean;
  confident: boolean;
  validation: LocalValidation;
  preview: LocalPagePreview | null;
}

/** Matching em camadas (código → nome exato → semelhança única). Ambiguidade nunca é aceita. */
function matchStudent(name: string, code: string | null, students: LocalContextStudent[]) {
  const outcome = matchStudentInClass({ name, code }, students);
  return { student: outcome.student, score: outcome.score, status: outcome.status };
}

export function parseGradePageLocal(tokens: TextToken[], context: LocalParseContext): LocalParseResult {
  const lines = groupLines(tokens);
  const grid = detectGrid(lines);
  const anchors = buildSubjectAnchors(context.expectedSubjects);

  if (!grid) {
    const validation = validateLocalPage({
      tokens, grid: null, cells: [], subjects: [], expectedSubjects: context.expectedSubjects,
      ambiguousCells: 0, orphanTokens: 0, studentName: null, matchScore: 0,
    });
    return { ok: false, confident: false, validation, preview: null };
  }

  const header = extractHeader(lines, grid.headerLineIndex);
  const built = buildCells(lines, grid, anchors);
  const { student: matched, score: matchScore, status: matchStatus } =
    matchStudent(header.name ?? '', header.student_code, context.students);

  const validation = validateLocalPage({
    tokens, grid, cells: built.cells, subjects: built.subjects,
    expectedSubjects: context.expectedSubjects,
    ambiguousCells: built.ambiguousCells, orphanTokens: built.orphanTokens,
    studentName: header.name, matchScore,
  });

  const status: 'matched' | 'fuzzy' | 'unmatched' =
    matchStatus === 'matched' ? 'matched' : matchStatus === 'fuzzy' ? 'fuzzy' : 'unmatched';
  const linked = status === 'unmatched' ? null : matched;
  const ambiguous = matchStatus === 'ambiguous';

  const subjectOrder = new Map<string, number>();
  built.subjects.forEach((s) => {
    const norm = normalizeText(s);
    if (!subjectOrder.has(norm)) subjectOrder.set(norm, subjectOrder.size);
  });

  const subjects = [...subjectOrder.entries()].map(([norm, order]) => {
    const name = built.subjects.find((s) => normalizeText(s) === norm) ?? norm;
    // Identidade canônica via âncoras (nome, aliases, abreviação); fallback: semelhança simples.
    const anchorMatch = matchSubjectAnchor(name, anchors);
    let matchedExpected: string | null = anchorMatch?.anchor.canonical ?? null;
    if (!matchedExpected) {
      let best = 0;
      for (const e of context.expectedSubjects) {
        const value = similarity(norm, normalizeText(e.name));
        if (value > best) { best = value; matchedExpected = e.name; }
      }
      if (best < 0.7) matchedExpected = null;
    }
    const expected = matchedExpected
      ? context.expectedSubjects.find((e) => e.name === matchedExpected)
      : undefined;
    return {
      normalized_name: norm,
      name,
      weekly_classes: expected?.weekly_classes ?? null,
      matched_expected: expected ? expected.name : null,
      sort_order: order,
    };
  });

  const periods = grid.columns.map((c) => ({
    normalized_label: normalizeText(c.label),
    label: c.label,
    kind: c.kind,
    sort_order: c.sort_order,
  }));

  const pdfName = header.name ?? '';
  const rows = built.cells.map((cell) => {
    const flags: string[] = [];
    if (cell.invalid) flags.push('invalid_value');
    if (!cell.invalid && cell.value == null) flags.push('empty_cell');
    if (cell.value === 0) flags.push('explicit_zero');
    if (cell.value != null && (cell.value < 0 || cell.value > 10)) flags.push('out_of_scale');
    if (cell.confidence < 0.7) flags.push('low_confidence');
    if (cell.anchored) flags.push('anchored_subject_row');
    if (status === 'fuzzy') flags.push('fuzzy_student_match');
    if (status === 'unmatched') flags.push('unmatched_student');
    return {
      student_name: pdfName,
      student_code: header.student_code,
      class_code: header.class_code,
      subject: cell.subject,
      period: cell.period,
      period_kind: cell.period_kind,
      raw_value: cell.raw_value,
      note_raw: cell.raw_value,
      note_numeric: cell.value,
      value: cell.value,
      page: context.page,
      source_page: context.page,
      confidence: cell.confidence,
      student_id: linked?.id ?? null,
      matched_name: linked?.full_name ?? null,
      match_score: matchScore,
      flags,
      source: 'local' as const,
    };
  }).sort((a, b) => {
    const bySubject = String(a.subject).localeCompare(String(b.subject), 'pt-BR');
    if (bySubject !== 0) return bySubject;
    return periodRank(a.period) - periodRank(b.period);
  });

  const conflicts: string[] = [];
  if (ambiguous) conflicts.push('ambiguous_match');
  if (status === 'unmatched' && !ambiguous) conflicts.push('not_in_class');
  if (status === 'fuzzy') conflicts.push('name_similar');
  if (linked) {
    const same = (a?: string | null, b?: string | null) =>
      (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    if (header.student_code && linked.school_code
      && digitsOnly(header.student_code) !== digitsOnly(linked.school_code)) conflicts.push('code_mismatch');
    if (header.birth_date && linked.birth_date && header.birth_date !== linked.birth_date) conflicts.push('birth_date_mismatch');
    if (header.mother_name && linked.mother_name && !same(header.mother_name, linked.mother_name)) conflicts.push('mother_mismatch');
    if (header.father_name && linked.father_name && !same(header.father_name, linked.father_name)) conflicts.push('father_mismatch');
  }

  const preview: LocalPagePreview = {
    page: context.page,
    total_pages: context.totalPages,
    pdf_class_code: header.class_code,
    student: {
      pdf_name: pdfName,
      pdf_code: header.student_code,
      pdf_birth_date: header.birth_date,
      pdf_mother_name: header.mother_name,
      pdf_father_name: header.father_name,
    },
    detected: {
      key: normalizeText(pdfName) || `pagina-${context.page}`,
      pdf_name: pdfName,
      pdf_code: header.student_code,
      pdf_birth_date: header.birth_date,
      pdf_mother_name: header.mother_name,
      pdf_father_name: header.father_name,
      pages: [context.page],
      cells: rows.length,
      student_id: linked?.id ?? null,
      matched_name: linked?.full_name ?? null,
      match_score: matchScore,
      status,
      conflicts,
      current: linked
        ? {
          school_code: linked.school_code ?? null,
          birth_date: linked.birth_date ?? null,
          mother_name: linked.mother_name ?? null,
          father_name: linked.father_name ?? null,
          student_id: linked.student_id ?? null,
        }
        : null,
    },
    subjects,
    periods: periods.sort((a, b) => a.sort_order - b.sort_order),
    rows,
    stats: {
      cells_total: rows.length,
      grades_read: rows.filter((r) => r.value != null).length,
      empty_cells: rows.filter((r) => r.value == null && !r.flags.includes('invalid_value')).length,
      explicit_zero_cells: rows.filter((r) => r.value === 0).length,
      invalid_values: rows.filter((r) => r.flags.includes('invalid_value')).length,
      low_confidence: rows.filter((r) => r.flags.includes('low_confidence')).length,
      subjects: subjects.length,
      periods: periods.length,
    },
    notes: validation.reasons.slice(0, 10),
    reading: {
      mode: 'local',
      escalated: false,
      reasons: validation.reasons,
      local_score: Number(validation.score.toFixed(3)),
      divergences: 0,
      absence_tokens_dropped: built.droppedAbsenceTokens,
      anchored_subjects: [...new Set(built.anchoredSubjects)],
      merged_subject_lines: built.mergedSubjectLines,
    },
  };

  return {
    ok: validation.conclusive,
    confident: isLocallyConfident(validation),
    validation,
    preview,
  };
}