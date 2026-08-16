/** Cabeçalho do aluno lido por rótulos âncora nas linhas acima da grade. */
import { normalizeAligned, toIsoDate } from './normalize';
import { extractSchoolCodeFromText } from './studentMatch';
import { LocalHeader, TokenLine } from './types';

const LABELS: { field: keyof LocalHeader; pattern: RegExp }[] = [
  { field: 'name', pattern: /\balun[oa]\s*a?\b/ },
  { field: 'student_code', pattern: /\bcodigo\b/ },
  { field: 'birth_date', pattern: /\b(data\s+de\s+nascimento|nascimento|dt\s+nasc)\b/ },
  { field: 'mother_name', pattern: /\b(nome\s+da\s+)?mae\b/ },
  { field: 'father_name', pattern: /\b(nome\s+do\s+)?pai\b/ },
  { field: 'class_code', pattern: /\bturma\b/ },
];

const clean = (value: string) =>
  value.replace(/^[\s:.,;\-–—()[\]]+/, '').replace(/[\s:.,;\-–—()[\]]+$/, '').trim();

/**
 * Varre cada linha, localiza os rótulos e toma como valor o texto até o próximo rótulo.
 * Nunca inventa valor: rótulo sem texto à direita => null.
 */
export function extractHeader(lines: TokenLine[], gridHeaderIndex: number | null): LocalHeader {
  const header: LocalHeader = {
    name: null, student_code: null, birth_date: null,
    mother_name: null, father_name: null, class_code: null,
  };
  const limit = gridHeaderIndex == null ? lines.length : gridHeaderIndex;

  for (let i = 0; i < limit; i++) {
    const raw = lines[i].text;
    if (!raw) continue;
    // Normalização alinhada: mesmos índices do texto original.
    const norm = normalizeAligned(raw);

    const hits: { field: keyof LocalHeader; start: number; end: number }[] = [];
    for (const { field, pattern } of LABELS) {
      const re = new RegExp(pattern.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(norm)) != null) {
        hits.push({ field, start: m.index, end: m.index + m[0].length });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
    if (hits.length === 0) continue;
    hits.sort((a, b) => a.start - b.start);

    hits.forEach((hit, index) => {
      if (header[hit.field]) return;
      const next = hits[index + 1];
      const from = hit.end;
      const to = next ? next.start : raw.length;
      const value = clean(raw.slice(from, Math.max(from, to)));
      if (!value) return;
      if (hit.field === 'birth_date') header.birth_date = toIsoDate(value);
      else if (hit.field === 'student_code') {
        // Código COMPLETO: recompõe dígitos + separadores e sanitiza (nunca só o 1º grupo).
        header.student_code = extractSchoolCodeFromText(value);
      }
      else header[hit.field] = value;
    });
  }

  return header;
}