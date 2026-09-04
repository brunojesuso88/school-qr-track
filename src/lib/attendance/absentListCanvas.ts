/**
 * Helpers puros de layout da imagem "Alunos Faltosos".
 *
 * Ficam separados do gerador para poderem ser testados sem canvas real:
 * a medição de texto entra como função injetada.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Trecho de texto com ou sem ênfase (negrito) dentro de um parágrafo. */
export interface RichSegment {
  text: string;
  bold?: boolean;
}

export type MeasureText = (text: string, bold: boolean) => number;

/** Quebra um texto simples respeitando a largura máxima. */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Quebra um parágrafo com trechos em negrito, preservando a ênfase.
 * Cada linha resultante é uma lista de segmentos já ajustada à largura.
 */
export function wrapSegments(
  measure: MeasureText,
  segments: RichSegment[],
  maxWidth: number,
): RichSegment[][] {
  const lines: RichSegment[][] = [];
  let line: RichSegment[] = [];
  let lineWidth = 0;

  const pushLine = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  segments.forEach((segment) => {
    const bold = Boolean(segment.bold);
    const chunks = String(segment.text ?? '').split(/(\n)/);
    chunks.forEach((chunk) => {
      if (chunk === '\n') {
        pushLine();
        return;
      }
      const words = chunk.split(' ');
      words.forEach((word, index) => {
        if (!word) return;
        const needsSpace = lineWidth > 0 && (index > 0 || line.length > 0);
        const piece = needsSpace ? ` ${word}` : word;
        const width = measure(piece, bold);
        if (lineWidth > 0 && lineWidth + width > maxWidth) {
          pushLine();
          const solo = measure(word, bold);
          line.push({ text: word, bold });
          lineWidth = solo;
          return;
        }
        line.push({ text: piece, bold });
        lineWidth += width;
      });
    });
  });
  if (line.length > 0) lines.push(line);
  return lines.filter((l, i, arr) => !(l.length === 0 && i === arr.length - 1));
}

/** Data completa em português com dia da semana: "Sexta-feira, 4 de setembro de 2026". */
export function formatAbsentDateLabel(date: Date): string {
  const label = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

/** Comunicado institucional exibido na própria imagem, abaixo da lista. */
export const ABSENT_NOTICE_PARAGRAPHS: RichSegment[][] = [
  [
    { text: 'Caso o(a) aluno(a) listado(a) possua ' },
    { text: 'justificativa para a falta', bold: true },
    { text: ', solicitamos que o responsável encaminhe ' },
    { text: 'ainda no mesmo dia', bold: true },
    { text: ' à escola o documento correspondente, como ' },
    { text: 'atestado médico ou outra justificativa válida para a ausência', bold: true },
    { text: '.' },
  ],
  [
    { text: '⚠️ O envio da justificativa é importante para que a escola possa realizar o devido registro e acompanhamento da frequência escolar.' },
  ],
  [{ text: 'Agradecemos a colaboração de todos.' }],
  [{ text: 'Equipe Gestora', bold: true }],
];
