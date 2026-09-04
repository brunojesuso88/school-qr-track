import { describe, it, expect } from 'vitest';
import { formatAbsentDateLabel, wrapSegments, wrapText } from '../absentListCanvas';

/** Medição fake: 10px por caractere. */
const measure = (text: string) => text.length * 10;

describe('layout da imagem de faltosos', () => {
  it('quebra texto simples respeitando a largura', () => {
    expect(wrapText(measure, 'um dois tres quatro', 100)).toEqual(['um dois', 'tres', 'quatro']);
  });

  it('preserva os trechos em negrito ao quebrar o parágrafo', () => {
    const lines = wrapSegments(
      (t) => measure(t),
      [{ text: 'envie o ' }, { text: 'atestado medico', bold: true }, { text: ' hoje' }],
      120,
    );
    const flat = lines.map((l) => l.map((s) => s.text).join(''));
    expect(flat.join(' ').replace(/\s+/g, ' ').trim()).toBe('envie o atestado medico hoje');
    expect(lines.flat().filter((s) => s.bold).map((s) => s.text.trim())).toEqual(['atestado', 'medico']);
  });

  it('formata a data com dia da semana em português', () => {
    expect(formatAbsentDateLabel(new Date(2026, 8, 4))).toBe('Sexta-feira, 4 de setembro de 2026');
  });
});
