/**
 * Exportação da lista de "Alunos Faltosos" de uma turma no dia.
 *
 * Fonte única usada tanto na página Turmas quanto em Frequência > Frequência diária.
 * Regra de faltoso: registros de `attendance` com status `absent` na data local.
 * Alunos com atestado ativo na data recebem o sufixo "— Atestado" (não são removidos).
 */
import { supabase } from '@/integrations/supabase/client';
import { fetchCoverage } from '@/hooks/useCertificateCoverage';
import { isCovered, type CoverageMap } from '@/lib/medicalCertificates/status';
import { localDateKey } from '@/lib/attendance/dailyStatus';

export interface AbsentRow {
  id: string;
  name: string;
}

/** Linhas exibidas no JPEG, já com marcação de atestado. */
export function buildAbsentLines(rows: AbsentRow[], coverage: CoverageMap, dateKey: string): string[] {
  return rows.map((r) => (isCovered(coverage, r.id, dateKey) ? `${r.name} — Atestado` : r.name));
}

/** Busca os faltosos da turma na data (mesma definição usada em Turmas). */
export async function fetchAbsentRows(className: string, dateKey: string): Promise<AbsentRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, students!inner(full_name, class)')
    .eq('date', dateKey)
    .eq('status', 'absent');

  if (error) throw error;

  return (data || [])
    .filter((a: any) => a.students?.class === className)
    .map((a: any) => ({ id: a.student_id as string, name: a.students.full_name as string }));
}

/** Desenha e dispara o download do JPEG da lista de faltosos. */
export function downloadAbsentListImage(className: string, dateKey: string, dateLabel: string, lines: string[]) {
  const lineHeight = 32;
  const padding = 40;
  const headerHeight = 100;
  const canvasHeight = headerHeight + lines.length * lineHeight + padding * 2;
  const canvasWidth = 600;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Alunos Faltosos - ${className}`, padding, padding + 24);

  ctx.fillStyle = '#666666';
  ctx.font = '14px sans-serif';
  ctx.fillText(dateLabel, padding, padding + 50);

  ctx.strokeStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(canvasWidth - padding, headerHeight);
  ctx.stroke();

  ctx.fillStyle = '#333333';
  ctx.font = '16px sans-serif';
  lines.forEach((name, i) => {
    const y = headerHeight + 20 + i * lineHeight;
    ctx.fillText(`${i + 1}. ${name}`, padding, y + 16);
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
 * Fluxo completo (buscar + cobertura + gerar imagem).
 * Retorna `empty` quando não há faltosos; lança em caso de erro.
 */
export async function exportAbsentStudents(
  className: string,
  dateLabel: string,
  date: Date = new Date(),
): Promise<AbsentExportResult> {
  const dateKey = localDateKey(date);
  const rows = await fetchAbsentRows(className, dateKey);
  if (rows.length === 0) return { status: 'empty', count: 0 };

  const coverage = await fetchCoverage(rows.map((r) => r.id), [dateKey]);
  const lines = buildAbsentLines(rows, coverage, dateKey);
  downloadAbsentListImage(className, dateKey, dateLabel, lines);
  return { status: 'ok', count: lines.length };
}
