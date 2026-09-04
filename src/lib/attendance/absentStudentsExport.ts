/**
 * Exportação da lista de "Alunos Faltosos" de uma turma no dia.
 *
 * Fonte única usada tanto na página Turmas quanto em Frequência > Frequência diária.
 * Regra de faltoso: registros de `attendance` com status `absent` na data local
 * (registros legados `justified` também contam como falta, por compatibilidade).
 * Alunos com atestado ativo na data recebem o sufixo "— Atestado" (não são removidos).
 */
import { supabase } from '@/integrations/supabase/client';
import { fetchCoverage } from '@/hooks/useCertificateCoverage';
import { isCovered, type CoverageMap } from '@/lib/medicalCertificates/status';
import { localDateKey } from '@/lib/attendance/dailyStatus';
import { fetchSchoolBranding, loadImageSafe } from '@/lib/school/brandingFetch';
import { documentSchoolName } from '@/lib/school/documentBranding';
import {
  ABSENT_NOTICE_PARAGRAPHS,
  formatAbsentDateLabel,
  wrapSegments,
  wrapText,
  type RichSegment,
} from './absentListCanvas';

export interface AbsentRow {
  id: string;
  name: string;
}

/** Linhas exibidas na imagem, já com marcação de atestado e em ordem alfabética. */
export function buildAbsentLines(rows: AbsentRow[], coverage: CoverageMap, dateKey: string): string[] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((r) => (isCovered(coverage, r.id, dateKey) ? `${r.name} — Atestado` : r.name));
}

/** Busca os faltosos da turma na data (mesma definição usada em Turmas). */
export async function fetchAbsentRows(
  className: string,
  dateKey: string,
  schoolId: string | null | undefined,
): Promise<AbsentRow[]> {
  if (!schoolId) return [];
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, students!inner(full_name, class)')
    .eq('school_id', schoolId)
    .eq('date', dateKey)
    .in('status', ['absent', 'justified']);

  if (error) throw error;

  return (data || [])
    .filter((a: any) => a.students?.class === className)
    .map((a: any) => ({ id: a.student_id as string, name: a.students.full_name as string }));
}

const WIDTH = 1080;
const PADDING = 64;
const CONTENT = WIDTH - PADDING * 2;

const font = (size: number, bold = false) => `${bold ? '700 ' : ''}${size}px "Helvetica Neue", Arial, sans-serif`;

/** Desenha e dispara o download do JPEG institucional da lista de faltosos. */
export async function downloadAbsentListImage(
  className: string,
  dateKey: string,
  dateLabel: string,
  lines: string[],
  branding: { schoolName: string; logo: HTMLImageElement | null },
) {
  const measureCanvas = document.createElement('canvas');
  const m = measureCanvas.getContext('2d')!;

  const schoolName = documentSchoolName(branding.schoolName);
  const logoBox = branding.logo ? 110 : 0;
  const headerTextWidth = CONTENT - (logoBox ? logoBox + 24 : 0);

  m.font = font(30, true);
  const schoolLines = wrapText((t) => m.measureText(t).width, schoolName.toUpperCase(), headerTextWidth);

  m.font = font(21);
  const noticeLines: RichSegment[][][] = ABSENT_NOTICE_PARAGRAPHS.map((p) =>
    wrapSegments((text, bold) => {
      m.font = font(21, bold);
      return m.measureText(text).width;
    }, p, CONTENT),
  );

  const headerBlock = Math.max(logoBox, schoolLines.length * 38) + 28;
  const titleBlock = 58 + 44 + 38 + 26;
  const listBlock = Math.max(lines.length, 1) * 40 + 20;
  const noticeBlock = noticeLines.reduce((acc, p) => acc + p.length * 32 + 20, 0);
  const height = PADDING + headerBlock + titleBlock + listBlock + 40 + noticeBlock + PADDING;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'alphabetic';

  let y = PADDING;

  // Cabeçalho: logo (proporção preservada) + nome da escola ativa
  let textX = PADDING;
  if (branding.logo) {
    const img = branding.logo;
    const scale = Math.min(logoBox / img.width, logoBox / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    try {
      ctx.drawImage(img, PADDING + (logoBox - w) / 2, y + (logoBox - h) / 2, w, h);
    } catch {
      /* logo indisponível: segue sem imagem */
    }
    textX = PADDING + logoBox + 24;
  }
  ctx.fillStyle = '#0f172a';
  ctx.font = font(30, true);
  let nameY = y + (branding.logo ? (logoBox - schoolLines.length * 38) / 2 + 30 : 30);
  schoolLines.forEach((line) => {
    ctx.fillText(line, textX, nameY);
    nameY += 38;
  });
  y += headerBlock;

  ctx.strokeStyle = '#0ea5a4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  y += 46;

  ctx.fillStyle = '#0f172a';
  ctx.font = font(42, true);
  ctx.fillText('ALUNOS FALTOSOS', PADDING, y);
  y += 46;

  ctx.fillStyle = '#0e7490';
  ctx.font = font(28, true);
  ctx.fillText(`Turma ${className}`, PADDING, y);
  y += 38;

  ctx.fillStyle = '#475569';
  ctx.font = font(21);
  ctx.fillText(dateLabel, PADDING, y);
  y += 26;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  y += 34;

  ctx.fillStyle = '#1e293b';
  ctx.font = font(23);
  if (lines.length === 0) {
    ctx.fillText('Nenhum aluno faltoso registrado.', PADDING, y);
    y += 40;
  } else {
    lines.forEach((name, i) => {
      ctx.fillText(`${i + 1}. ${name}`, PADDING, y);
      y += 40;
    });
  }
  y += 20;

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  y += 40;

  ctx.fillStyle = '#1e293b';
  noticeLines.forEach((paragraph) => {
    paragraph.forEach((line) => {
      let x = PADDING;
      line.forEach((seg) => {
        ctx.font = font(21, Boolean(seg.bold));
        ctx.fillText(seg.text, x, y);
        x += ctx.measureText(seg.text).width;
      });
      y += 32;
    });
    y += 20;
  });

  const link = document.createElement('a');
  link.download = `faltosos_${className.replace(/\s/g, '_')}_${dateKey}.jpg`;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}

export interface AbsentExportResult {
  status: 'empty' | 'ok';
  count: number;
}

/**
 * Fluxo completo (buscar + cobertura + branding + gerar imagem).
 * Retorna `empty` quando não há faltosos; lança em caso de erro.
 * A data de saída é sempre formatada aqui (dia da semana em pt-BR).
 */
export async function exportAbsentStudents(
  className: string,
  schoolId: string | null | undefined,
  date: Date = new Date(),
): Promise<AbsentExportResult> {
  if (!schoolId) return { status: 'empty', count: 0 };
  const dateKey = localDateKey(date);
  const rows = await fetchAbsentRows(className, dateKey, schoolId);
  if (rows.length === 0) return { status: 'empty', count: 0 };

  const coverage = await fetchCoverage(rows.map((r) => r.id), [dateKey]);
  const lines = buildAbsentLines(rows, coverage, dateKey);
  const branding = await fetchSchoolBranding(schoolId);
  const logo = await loadImageSafe(branding.logoUrl);
  await downloadAbsentListImage(className, dateKey, formatAbsentDateLabel(date), lines, {
    schoolName: branding.schoolName,
    logo,
  });
  return { status: 'ok', count: lines.length };
}
