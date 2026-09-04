/** Reconstrução da grade do boletim a partir de tokens + coordenadas. Determinístico, sem IA. */
import {
  classifyPeriodLabel, isAbsenceLabel, isEmptyMarker, isGradeLabel, looksLikeGradeToken,
  isIgnoredPeriodKind, normalizeText, parseGradeToken, periodRank,
} from './normalize';
import { GridLayout, LocalCell, TextToken, TokenLine } from './types';
import { AnchorMatch, SubjectAnchor, anchorConfidence, matchSubjectAnchor } from './subjectAnchors';

/** Agrupa tokens em linhas por proximidade vertical (tolerância proporcional à fonte). */
export function groupLines(tokens: TextToken[]): TokenLine[] {
  const usable = tokens.filter((t) => t.text.trim().length > 0);
  if (usable.length === 0) return [];
  const heights = usable.map((t) => t.h).filter((h) => h > 0).sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)] : 8;
  const tol = Math.max(1.5, median * 0.6);

  const sorted = [...usable].sort((a, b) => b.y - a.y);
  const lines: TokenLine[] = [];
  for (const token of sorted) {
    const line = lines.find((l) => Math.abs(l.y - token.y) <= tol);
    if (line) {
      line.tokens.push(token);
      line.height = Math.max(line.height, token.h);
    } else {
      lines.push({ y: token.y, height: token.h || median, tokens: [token], text: '' });
    }
  }
  lines.forEach((l) => {
    l.tokens.sort((a, b) => a.x - b.x);
    l.text = l.tokens.map((t) => t.text.trim()).filter(Boolean).join(' ');
  });
  return lines.sort((a, b) => b.y - a.y);
}

interface LabelHit {
  canonical: string;
  kind: string;
  start: number;
  end: number;
}

/** Procura rótulos de período na linha, aceitando o rótulo quebrado em até 3 tokens. */
function periodHitsInLine(line: TokenLine): LabelHit[] {
  const hits: LabelHit[] = [];
  const tokens = line.tokens;
  let i = 0;
  while (i < tokens.length) {
    let matched: LabelHit | null = null;
    for (let span = 3; span >= 1; span--) {
      const slice = tokens.slice(i, i + span);
      if (slice.length < span) continue;
      const label = slice.map((t) => t.text.trim()).join(' ');
      const cls = classifyPeriodLabel(label);
      if (cls) {
        matched = {
          canonical: cls.canonical,
          kind: cls.kind,
          start: Math.min(...slice.map((t) => t.x)),
          end: Math.max(...slice.map((t) => t.x + t.w)),
        };
        i += span;
        break;
      }
    }
    if (matched) hits.push(matched);
    else i++;
  }
  return hits;
}

/**
 * Detecta a grade: linha de cabeçalho de períodos + linha de subcolunas Nota/Faltas.
 * As faixas x saem SEMPRE dos rótulos desta página (nenhuma coordenada fixa).
 */
export function detectGrid(lines: TokenLine[]): GridLayout | null {
  let bestIndex = -1;
  let bestHits: LabelHit[] = [];
  lines.forEach((line, index) => {
    const hits = periodHitsInLine(line);
    if (hits.length > bestHits.length) { bestHits = hits; bestIndex = index; }
  });
  if (bestIndex === -1 || bestHits.length === 0) return null;

  // Fronteiras horizontais entre períodos (ponto médio entre o fim de um e o início do próximo).
  const ordered = [...bestHits].sort((a, b) => a.start - b.start);
  const bounds = ordered.map((hit, i) => {
    const prev = ordered[i - 1];
    const next = ordered[i + 1];
    const start = prev ? (prev.end + hit.start) / 2 : hit.start - (hit.end - hit.start) * 0.6;
    const end = next ? (hit.end + next.start) / 2 : hit.end + (hit.end - hit.start) * 0.6;
    return { hit, start, end };
  });

  // Linha das subcolunas: primeira linha abaixo do cabeçalho com Nota e/ou Faltas.
  let subIndex: number | null = null;
  for (let i = bestIndex + 1; i < Math.min(lines.length, bestIndex + 4); i++) {
    const hasLabels = lines[i].tokens.some((t) => isGradeLabel(t.text) || isAbsenceLabel(t.text));
    if (hasLabels) { subIndex = i; break; }
  }

  const columns: GridLayout['columns'] = [];
  const absenceColumns: GridLayout['absenceColumns'] = [];
  const ignoredColumns: GridLayout['ignoredColumns'] = [];

  for (const b of bounds) {
    // Colunas finais (Média Final, Rec. Final, Cons. Class, Pendência, Final) nunca viram nota.
    if (isIgnoredPeriodKind(b.hit.kind)) {
      ignoredColumns.push({ start: b.start, end: b.end });
      continue;
    }
    const subTokens = subIndex == null
      ? []
      : lines[subIndex].tokens.filter((t) => {
        const center = t.x + t.w / 2;
        return center >= b.start && center <= b.end;
      });
    const nota = subTokens.find((t) => isGradeLabel(t.text));
    const falta = subTokens.find((t) => isAbsenceLabel(t.text));

    if (nota && falta) {
      const divider = (nota.x + nota.w + falta.x) / 2;
      columns.push({
        label: b.hit.canonical, kind: b.hit.kind, sort_order: periodRank(b.hit.canonical),
        start: b.start, end: divider,
      });
      absenceColumns.push({ start: divider, end: b.end });
    } else if (nota) {
      columns.push({
        label: b.hit.canonical, kind: b.hit.kind, sort_order: periodRank(b.hit.canonical),
        start: b.start, end: b.end,
      });
    } else if (falta) {
      // Só Faltas dentro da faixa: nada de nota aqui, coluna inteira descartada.
      absenceColumns.push({ start: b.start, end: b.end });
    } else {
      columns.push({
        label: b.hit.canonical, kind: b.hit.kind, sort_order: periodRank(b.hit.canonical),
        start: b.start, end: b.end,
      });
    }
  }

  if (columns.length === 0) return null;

  const subjectColumnEnd = Math.min(...bounds.map((b) => b.start));
  return {
    columns: columns.sort((a, b) => a.sort_order - b.sort_order || a.start - b.start),
    absenceColumns,
    ignoredColumns,
    subjectColumnEnd,
    headerLineIndex: bestIndex,
    subHeaderLineIndex: subIndex,
  };
}

const SUBJECT_STOPWORDS = [
  'aluno', 'aluna', 'codigo', 'escola', 'turma', 'mae', 'pai', 'disciplina', 'disciplinas',
  'faltas', 'total', 'observacoes', 'observacao', 'assinatura', 'data', 'resultado', 'situacao',
  'ano', 'serie', 'secretaria', 'boletim', 'nascimento', 'periodo', 'bimestre', 'etapa',
  'diretor', 'diretora', 'secretario', 'emitido', 'pagina', 'nota', 'media', 'final',
  'frequencia', 'legenda', 'responsavel', 'matricula', 'estado', 'municipio', 'unidade',
];

const HARD_STOPWORDS = /\b(legenda|assinatura|observac|resultado final|total geral|pagina)\b/;

const isSubjectLabel = (text: string) => {
  const norm = normalizeText(text);
  if (norm.length < 3) return false;
  if (!/[a-z]/.test(norm)) return false;
  if (HARD_STOPWORDS.test(norm)) return false;
  const words = norm.split(' ').filter(Boolean);
  if (words.every((w) => SUBJECT_STOPWORDS.includes(w))) return false;
  return true;
};

export interface BuildCellsResult {
  cells: LocalCell[];
  subjects: string[];
  ambiguousCells: number;
  droppedAbsenceTokens: number;
  orphanTokens: number;
  /** Tokens fora das colunas conhecidas que PARECEM nota (risco real de leitura). */
  orphanGradeTokens: number;
  /** Disciplinas reconhecidas por âncora curricular sem nenhuma nota lançada. */
  anchoredSubjects: string[];
  /** Linhas de disciplina fundidas (nome quebrado em duas linhas do PDF). */
  mergedSubjectLines: number;
}

/**
 * Vincula cada token numérico à célula (disciplina × período) pela geometria.
 * Quando a linha tem nome de disciplina e nenhum token dentro da grade, tenta reconhecer
 * a disciplina pelas âncoras curriculares da turma e materializa 4 células vazias (null).
 */
export function buildCells(lines: TokenLine[], grid: GridLayout, anchors: SubjectAnchor[] = []): BuildCellsResult {
  const cells: LocalCell[] = [];
  const subjects: string[] = [];
  const anchoredSubjects: string[] = [];
  let ambiguousCells = 0;
  let droppedAbsenceTokens = 0;
  let orphanTokens = 0;
  let orphanGradeTokens = 0;
  let mergedSubjectLines = 0;

  const firstDataLine = (grid.subHeaderLineIndex ?? grid.headerLineIndex) + 1;

  /**
   * Nome de disciplina pendente: linha de texto ainda não fechada.
   * `match` != null => já reconhecida na matriz, mas a materialização vazia é DIFERIDA:
   * a próxima linha ainda pode trazer as notas dela (nome quebrado antes das notas).
   */
  let pending: { text: string; y: number; height: number; match: AnchorMatch | null } | null = null;

  /** Materializa a linha inteira vazia (uma célula null por período). */
  const pushAnchoredRow = (name: string, match: AnchorMatch) => {
    anchoredSubjects.push(match.anchor.canonical);
    subjects.push(match.anchor.canonical);
    for (const column of grid.columns) {
      cells.push({
        subject: match.anchor.canonical,
        period: column.label,
        period_kind: column.kind,
        raw_value: null,
        value: null,
        invalid: false,
        confidence: anchorConfidence(match.kind),
        ambiguous: false,
        anchored: true,
      });
    }
  };

  /**
   * Fecha o pendente sem consumo: se ele já era uma disciplina reconhecida da matriz,
   * entra como linha vazia (null em todos os períodos). Nunca herda notas de outra linha.
   */
  const flushPending = () => {
    if (pending?.match) pushAnchoredRow(pending.text, pending.match);
    pending = null;
  };

  for (let i = firstDataLine; i < lines.length; i++) {
    const line = lines[i];
    const subjectTokens = line.tokens.filter((t) => t.x + t.w / 2 < grid.subjectColumnEnd);
    const subjectName = subjectTokens.map((t) => t.text.trim()).filter(Boolean).join(' ').trim();

    const valueTokens = line.tokens.filter((t) => t.x + t.w / 2 >= grid.subjectColumnEnd);
    // Linha de dados só é considerada se houver token DENTRO da grade (nota ou falta).
    const insideGrid = valueTokens.some((t) => {
      const center = t.x + t.w / 2;
      return grid.columns.some((c) => center >= c.start && center < c.end)
        || grid.absenceColumns.some((a) => center >= a.start && center < a.end)
        || grid.ignoredColumns.some((a) => center >= a.start && center < a.end);
    });

    // Proximidade vertical com o nome pendente (nome longo quebrado em duas linhas).
    const nearPending = Boolean(pending)
      && Math.abs(pending!.y - line.y) <= Math.max(pending!.height, line.height) * 2.2;

    let rowName = subjectName;
    let consumedPending = false;

    if (!subjectName || !isSubjectLabel(subjectName)) {
      // Continuidade determinística: fragmento curto (`I`, `II`) ou linha só com valores.
      // Exige nome pendente próximo E âncora curricular INEQUÍVOCA da matriz da turma.
      if (nearPending && insideGrid && anchors.length > 0) {
        const candidate = subjectName
          ? `${pending!.text} ${subjectName}`.replace(/\s+/g, ' ').trim()
          : pending!.text;
        const match = matchSubjectAnchor(candidate, anchors);
        const unequivocal = match
          && (match.kind === 'exact' || match.kind === 'alias' || match.kind === 'abbreviation');
        if (unequivocal) { rowName = candidate; mergedSubjectLines++; consumedPending = true; }
      }
      // Sem âncora inequívoca a linha é descartada: números soltos NUNCA herdam disciplina.
      if (!consumedPending) { flushPending(); continue; }
      pending = null;
    } else {
      // Fusão segura: nome quebrado em duas linhas verticalmente próximas na coluna de disciplinas.
      const mergedName = nearPending
        ? `${pending!.text} ${subjectName}`.replace(/\s+/g, ' ').trim()
        : null;
      if (mergedName && anchors.length > 0) {
        const plain = matchSubjectAnchor(subjectName, anchors);
        const merged = matchSubjectAnchor(mergedName, anchors);
        if (!plain && merged) { rowName = mergedName; mergedSubjectLines++; consumedPending = true; }
      }
      // Pendente anterior não continua nesta linha: fecha antes de seguir.
      if (consumedPending) pending = null;
      else flushPending();
    }

    if (!insideGrid) {
      // Linha de disciplina sem nota nesta linha: reconhecimento pela matriz fica PENDENTE,
      // porque as notas podem estar na linha seguinte (nome quebrado antes dos valores).
      const match = anchors.length > 0 ? matchSubjectAnchor(rowName, anchors) : null;
      pending = { text: rowName, y: line.y, height: line.height, match };
      continue;
    }
    pending = null;
    const byColumn = new Map<string, { texts: string[]; ambiguous: boolean }>();

    for (const token of valueTokens) {
      const text = token.text.trim();
      if (!text) continue;
      const center = token.x + token.w / 2;

      // Faltas: descartado ANTES de qualquer parsing.
      if (grid.absenceColumns.some((a) => center >= a.start && center < a.end)) {
        droppedAbsenceTokens++;
        continue;
      }

      // Colunas finais do boletim: descartadas antes de qualquer parsing.
      if (grid.ignoredColumns.some((a) => center >= a.start && center < a.end)) continue;

      const owners = grid.columns.filter((c) => center >= c.start && center < c.end);
      if (owners.length === 0) {
        if (looksLikeGradeToken(text)) orphanGradeTokens++;
        else orphanTokens++;
        continue;
      }
      const column = owners[0];
      // Token cruzando a fronteira de duas colunas aceitas => ambíguo.
      const spansBoundary = owners.length > 1 ||
        grid.columns.some((c) => c !== column && token.x < c.end && token.x + token.w > c.start);
      if (!looksLikeGradeToken(text) && !isEmptyMarker(text)) { orphanTokens++; continue; }
      const entry = byColumn.get(column.label) ?? { texts: [], ambiguous: false };
      entry.texts.push(text);
      if (spansBoundary) entry.ambiguous = true;
      byColumn.set(column.label, entry);
    }

    // Identidade canônica: alias/eixo do boletim (ex. "APROFUNDAMENTO IF - CNS - I")
    // passa a ser gravado com o nome canônico da matriz, evitando duplicatas.
    const rowAnchor = anchors.length > 0 ? matchSubjectAnchor(rowName, anchors) : null;
    const canonicalName = rowAnchor?.anchor.canonical ?? rowName;
    subjects.push(canonicalName);
    for (const column of grid.columns) {
      const entry = byColumn.get(column.label);
      const distinct = [...new Set((entry?.texts ?? []).filter((t) => !isEmptyMarker(t)))];
      const ambiguous = Boolean(entry?.ambiguous) || distinct.length > 1;
      const rawValue = distinct.length > 0 ? distinct[0] : null;
      const { value, invalid } = parseGradeToken(rawValue);
      if (ambiguous) ambiguousCells++;
      cells.push({
        subject: canonicalName,
        period: column.label,
        period_kind: column.kind,
        raw_value: rawValue,
        value,
        invalid,
        confidence: ambiguous ? 0.5 : 1,
        ambiguous,
      });
    }
  }

  return {
    cells, subjects, ambiguousCells, droppedAbsenceTokens, orphanTokens, orphanGradeTokens,
    anchoredSubjects, mergedSubjectLines,
  };
}