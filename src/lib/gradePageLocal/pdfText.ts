/**
 * Extração de texto + coordenadas com pdfjs-dist, no navegador.
 * O documento é aberto UMA vez por sessão e reutilizado em todas as páginas.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { TextToken } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type LocalPdfDocument = PDFDocumentProxy;

export async function openPdfDocument(data: ArrayBuffer): Promise<LocalPdfDocument> {
  // cópia: o pdfjs assume o buffer, e o mesmo arquivo também é enviado à sessão
  const bytes = new Uint8Array(data.slice(0));
  return await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
}

export async function extractPageTokens(doc: LocalPdfDocument, pageNumber: number): Promise<TextToken[]> {
  const page = await doc.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    const tokens: TextToken[] = [];
    for (const item of content.items as { str?: string; transform?: number[]; width?: number; height?: number }[]) {
      const text = String(item.str ?? '').trim();
      if (!text) continue;
      const transform = item.transform ?? [];
      tokens.push({
        text,
        x: Number(transform[4] ?? 0),
        y: Number(transform[5] ?? 0),
        w: Number(item.width ?? 0),
        h: Number(item.height ?? (Math.abs(Number(transform[3] ?? 0)) || 8)),
      });
    }
    return tokens;
  } finally {
    page.cleanup();
  }
}

export const closePdfDocument = (doc: LocalPdfDocument | null) => {
  try { void doc?.destroy(); } catch { /* ignora */ }
};