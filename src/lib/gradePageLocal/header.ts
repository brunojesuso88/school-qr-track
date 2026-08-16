/** Cabeçalho do aluno lido por rótulos âncora nas linhas acima da grade. */
import { normalizeText, toIsoDate } from './normalize';
import { LocalHeader, TokenLine } from './types';

const LABELS: { field: keyof LocalHeader; pattern: RegExp }[] = [
  { field: 'name', pattern: /alun[oa]\s*\(?a?\)?/ },
  { field: 'student_code', pattern: /codigo/ },
  { field: 'birth_date', pattern: /(data\s+de\s+nascimento|nascimento|dt\s+nasc)/ },
  { field: 'mother_name', pattern: /(nome\s+da\s+)?mae/ },
  { field: 'father_name', pattern: /(nome\s+do\s+)?pai/ },
  { field: 'class_code', pattern: /turma/ },
];

const clean = (value: string) => value.replace(/^[\s:.\-–—]+/, '').replace(/[\s:.\-–—]+$/, '').trim();

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
    const norm = normalizeText(raw);

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

    // Mapa de posições: o texto normalizado e o original mantêm a mesma quantidade de palavras.
    const normWords = norm.split(' ');
    const rawWords = raw.split(/\s+/);
    const wordIndexAt = (charIndex: number) => {
      let acc = 0;
      for (let w = 0; w < normWords.length; w++) {
        acc += normWords[w].length + (w > 0 ? 1 : 0);
        if (charIndex < acc) return w;
      }
      return normWords.length;
    };

    hits.forEach((hit, index) => {
      if (header[hit.field]) return;
      const fromWord = wordIndexAt(hit.end) + 1;
      const next = hits[index + 1];
      const toWord = next ? wordIndexAt(next.start) : rawWords.length;
      const value = clean(rawWords.slice(fromWord, Math.max(fromWord, toWord)).join(' '));
      if (!value) return;
      if (hit.field === 'birth_date') header.birth_date = toIsoDate(value);
      else if (hit.field === 'student_code') header.student_code = (value.match(/[0-9A-Za-z]+/) ?? [null])[0];
      else header[hit.field] = value;
    });
  }

  return header;
}