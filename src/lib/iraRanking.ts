/**
 * Classificação (ranking) do IRA — serviço de dados + geração do PDF.
 *
 * Reutiliza EXATAMENTE o motor de cálculo do card/detalhe do aluno
 * (`computeIraForStudent`), respeitando a configuração de IRA de cada turma.
 * Nenhum nome de aluno é carregado para o PDF (privacidade).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  ClassGradesData, GradePeriodRow, GradeSubjectRow, IraSettingsRow, StudentGradeRow,
  computeIraForStudent, fetchGradesPaged, resolveIraPeriods,
} from '@/hooks/useStudentGrades';
import { formatIra } from '@/lib/ira';

export const RANKING_LIMIT = 15;

/** Código do aluno apenas com dígitos (sem pontos, vírgulas, traços ou espaços). */
export const formatStudentCode = (code: string | null) => {
  const digits = (code || '').replace(/\D/g, '');
  return digits || '';
};

export interface RankingEntry {
  studentId: string;
  /** Código do aluno (students.school_code) — pode faltar. */
  code: string | null;
  birthDate: string | null;
  className: string;
  ira: number;
}

export interface RankingResult {
  /** Todos os elegíveis, ordenados (IRA desc, código asc). */
  ranked: RankingEntry[];
  /** Top N exportável. */
  top: RankingEntry[];
  eligibleCount: number;
  ineligibleCount: number;
  /** Elegíveis no Top N sem código ou sem data de nascimento. */
  missingDataCount: number;
  /** Turmas selecionadas sem configuração de IRA. */
  classesWithoutConfig: string[];
  periodsLabel: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Carrega e calcula a classificação em lote (poucas queries, cálculo em memória). */
export async function buildIraRanking(classIds: string[]): Promise<RankingResult> {
  if (classIds.length === 0) {
    return { ranked: [], top: [], eligibleCount: 0, ineligibleCount: 0, missingDataCount: 0, classesWithoutConfig: [], periodsLabel: '' };
  }

  const { data: classRows, error: classErr } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', classIds);
  if (classErr) throw classErr;
  const classes = (classRows || []) as { id: string; name: string }[];
  const classNames = classes.map((c) => c.name);

  const [studentsRes, subjRes, perRes, settingsRes] = await Promise.all([
    supabase.from('students').select('id, school_code, student_id, birth_date, class, status').in('class', classNames),
    supabase.from('grade_subjects').select('*').in('class_id', classIds).order('sort_order'),
    supabase.from('grade_periods').select('*').in('class_id', classIds).order('sort_order'),
    supabase.from('ira_settings').select('*').in('class_id', classIds),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (subjRes.error) throw subjRes.error;
  if (perRes.error) throw perRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const students = (studentsRes.data || []).filter((s) => s.status !== 'inactive') as {
    id: string; school_code: string | null; student_id: string; birth_date: string | null; class: string;
  }[];
  const subjects = (subjRes.data || []) as unknown as GradeSubjectRow[];
  const periods = (perRes.data || []) as unknown as GradePeriodRow[];
  const settings = (settingsRes.data || []) as unknown as IraSettingsRow[];

  const grades: StudentGradeRow[] = await fetchGradesPaged(subjects.map((s) => s.id));

  const mappingIds = subjects.map((s) => s.mapping_class_subject_id).filter(Boolean) as string[];
  const currentWeeklyClasses: Record<string, number> = {};
  if (mappingIds.length > 0) {
    const { data } = await supabase.from('mapping_class_subjects').select('id, weekly_classes').in('id', mappingIds);
    (data || []).forEach((row: { id: string; weekly_classes: number }) => {
      currentWeeklyClasses[row.id] = row.weekly_classes;
    });
  }

  const classIdByName = new Map<string, string>();
  classes.forEach((c) => {
    classIdByName.set(c.name, c.id);
    classIdByName.set(norm(c.name), c.id);
  });
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const dataByClass = new Map<string, ClassGradesData>();
  classIds.forEach((classId) => {
    const ids = new Set(subjects.filter((s) => s.class_id === classId).map((s) => s.id));
    dataByClass.set(classId, {
      subjects: subjects.filter((s) => s.class_id === classId),
      periods: periods.filter((p) => p.class_id === classId),
      grades: grades.filter((g) => ids.has(g.grade_subject_id)),
      settings: settings.find((s) => s.class_id === classId) ?? null,
      currentWeeklyClasses,
    });
  });

  const classesWithoutConfig = classIds
    .filter((id) => resolveIraPeriods(dataByClass.get(id)!).length === 0)
    .map((id) => classNameById.get(id) || id);

  const ranked: RankingEntry[] = [];
  let ineligibleCount = 0;
  students.forEach((s) => {
    const classId = classIdByName.get(s.class) ?? classIdByName.get(norm(s.class));
    const data = classId ? dataByClass.get(classId) : undefined;
    if (!data) { ineligibleCount++; return; }
    const result = computeIraForStudent(data, s.id);
    if (result.status !== 'ok' || result.value == null || Number.isNaN(result.value)) {
      ineligibleCount++;
      return;
    }
    ranked.push({
      studentId: s.id,
      code: s.school_code || null,
      birthDate: s.birth_date,
      className: s.class,
      ira: result.value,
    });
  });

  // Empates: IRA desc, depois código crescente (estável e determinístico).
  ranked.sort((a, b) => {
    if (b.ira !== a.ira) return b.ira - a.ira;
    return (a.code || '\uffff').localeCompare(b.code || '\uffff', 'pt-BR', { numeric: true });
  });

  const top = ranked.slice(0, RANKING_LIMIT);
  const missingDataCount = top.filter((e) => !e.code || !e.birthDate).length;

  // Rótulo dos períodos (quando todas as turmas usam a mesma base)
  const labels = [...new Set(classIds.map((id) =>
    resolveIraPeriods(dataByClass.get(id)!).map((p) => p.label).join(' + ')).filter(Boolean))];
  const periodsLabel = labels.length === 1 ? labels[0] : labels.length > 1 ? 'configuração própria de cada turma' : '';

  return {
    ranked,
    top,
    eligibleCount: ranked.length,
    ineligibleCount,
    missingDataCount,
    classesWithoutConfig,
    periodsLabel,
  };
}

export const formatBirthDate = (value: string | null) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};

const MEDALS: Record<number, { fill: [number, number, number]; ring: [number, number, number] }> = {
  // Tons metálicos: ouro, prata e bronze.
  1: { fill: [212, 175, 55], ring: [150, 118, 20] },
  2: { fill: [188, 194, 200], ring: [132, 138, 145] },
  3: { fill: [176, 124, 74], ring: [120, 80, 44] },
};

/** Desenha uma medalha discreta (círculo com anel) centrada em (cx, cy). */
function drawMedal(doc: jsPDF, cx: number, cy: number, place: number) {
  const m = MEDALS[place];
  if (!m) return;
  doc.setFillColor(...m.fill);
  doc.setDrawColor(...m.ring);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, 2.0, 'FD');
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, 0.65, 'F');
}

export interface RankingPdfOptions {
  classNames: string[];
  periodsLabel: string;
  totalEligible: number;
  /** URL do brasão da escola (opcional). */
  logoUrl?: string;
}

const SCHOOL = 'Centro de Ensino Professor Antônio Nonato Sampaio';
const TITLE = 'CLASSIFICAÇÃO DE DESEMPENHO — RANKING DO IRA';
const BRAND: [number, number, number] = [12, 64, 122];
const BRAND_MID: [number, number, number] = [21, 101, 192];
const ACCENT: [number, number, number] = [37, 128, 214];

/** Carrega o brasão da escola como dataURL (falha silenciosa). */
async function loadLogo(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Monta o documento da classificação (uma única página A4 paisagem). */
export async function buildIraRankingPdf(entries: RankingEntry[], options: RankingPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const rows = entries.slice(0, RANKING_LIMIT);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  // Faixa institucional (degradê discreto em azuis)
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...BRAND_MID);
  doc.rect(0, 24, pageWidth, 4, 'F');

  const logo = await loadLogo(options.logoUrl ?? '');
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.circle(margin + 11, 14, 11.4, 'F');
    try {
      doc.addImage(logo, 'PNG', margin + 1.5, 4.5, 19, 19);
    } catch {
      /* ignora logo inválido */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(SCHOOL.toUpperCase(), pageWidth / 2, 9, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text(TITLE, pageWidth / 2, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Os melhores desempenhos acadêmicos${options.periodsLabel ? ` · Base: ${options.periodsLabel}` : ''}`,
    pageWidth / 2, 22.5, { align: 'center' },
  );

  doc.setTextColor(70, 80, 90);
  doc.setFontSize(8);
  doc.text(`Turmas/Séries: ${options.classNames.join(', ')}`, margin, 34, { maxWidth: pageWidth - margin * 2 - 70 });
  doc.text(
    `Emitido em ${format(new Date(), 'dd/MM/yyyy')} · ${rows.length} de ${options.totalEligible} elegível(is)`,
    pageWidth - margin, 34, { align: 'right' },
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT);
  doc.text(
    'SUPERE SEUS LIMITES — O PRÓXIMO NOME NO TOPO PODE SER O SEU.',
    pageWidth / 2, 41, { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: 45,
    margin: { left: margin, right: margin, bottom: 8 },
    head: [['Colocação', 'Código do aluno', 'Data de nascimento', 'Turma/Série', 'IRA']],
    body: rows.map((e, i) => [
      `${i + 1}º`,
      formatStudentCode(e.code) || 'não informado',
      formatBirthDate(e.birthDate),
      e.className,
      formatIra(e.ira),
    ]),
    theme: 'grid',
    styles: {
      fontSize: 9.5, cellPadding: 1.7, textColor: [35, 45, 55],
      lineColor: [214, 228, 244], lineWidth: 0.2, valign: 'middle',
    },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9.5 },
    alternateRowStyles: { fillColor: [240, 246, 253] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 32, textColor: BRAND, fontSize: 11 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const place = data.row.index + 1;
      if (place <= 3) {
        data.cell.styles.fillColor = place === 1 ? [214, 233, 255] : place === 2 ? [228, 240, 252] : [236, 245, 253];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = BRAND;
        if (data.column.index === 0) data.cell.text = [`      ${place}º`];
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0 && data.row.index + 1 <= 3) {
        drawMedal(doc, data.cell.x + 6, data.cell.y + data.cell.height / 2, data.row.index + 1);
      }
    },
  });

  return doc;
}

/** Gera e baixa o PDF da classificação. Nenhum nome de aluno é usado. */
export async function generateIraRankingPdf(entries: RankingEntry[], options: RankingPdfOptions) {
  const doc = await buildIraRankingPdf(entries, options);
  doc.save(`classificacao_ira_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
