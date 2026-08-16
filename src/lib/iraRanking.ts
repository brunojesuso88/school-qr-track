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
  2: { fill: [190, 196, 202], ring: [132, 138, 145] },
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

const SCHOOL_LINE_1 = 'CENTRO DE ENSINO';
const SCHOOL_LINE_2 = 'PROFESSOR ANTÔNIO NONATO SAMPAIO';
const TITLE_TOP = 'CLASSIFICAÇÃO DE DESEMPENHO';
const TITLE_MAIN = 'RANKING DO IRA';

const NAVY: [number, number, number] = [10, 46, 92];
const ROYAL: [number, number, number] = [21, 101, 192];
const LIGHT: [number, number, number] = [232, 241, 252];
const FRAME: [number, number, number] = [176, 202, 232];
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_DARK: [number, number, number] = [150, 115, 18];
const GOLD_LIGHT: [number, number, number] = [240, 214, 120];

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

/** Troféu dourado vetorial (taça, alças, pedestal e louros). */
function drawGoldenTrophy(doc: jsPDF, cx: number, cy: number, scale = 1) {
  const s = scale;
  // Louros laterais
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.5 * s);
  for (let i = 0; i < 4; i++) {
    const dy = cy - 2 * s + i * 2.6 * s;
    doc.setFillColor(...GOLD_LIGHT);
    doc.ellipse(cx - 11 * s + i * 0.7 * s, dy, 2.2 * s, 1.1 * s, 'FD');
    doc.ellipse(cx + 11 * s - i * 0.7 * s, dy, 2.2 * s, 1.1 * s, 'FD');
  }
  // Alças
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(1.1 * s);
  doc.line(cx - 6.2 * s, cy - 6 * s, cx - 8.6 * s, cy - 2.4 * s);
  doc.line(cx - 8.6 * s, cy - 2.4 * s, cx - 6.0 * s, cy - 0.6 * s);
  doc.line(cx + 6.2 * s, cy - 6 * s, cx + 8.6 * s, cy - 2.4 * s);
  doc.line(cx + 8.6 * s, cy - 2.4 * s, cx + 6.0 * s, cy - 0.6 * s);
  // Copa
  doc.setFillColor(...GOLD);
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.4 * s);
  doc.triangle(
    cx - 6.4 * s, cy - 6.6 * s,
    cx + 6.4 * s, cy - 6.6 * s,
    cx, cy + 3.4 * s,
    'FD',
  );
  doc.setFillColor(...GOLD_LIGHT);
  doc.triangle(cx - 4.4 * s, cy - 5.6 * s, cx - 1.2 * s, cy - 5.6 * s, cx - 2.6 * s, cy - 0.4 * s, 'F');
  // Borda superior
  doc.setFillColor(...GOLD);
  doc.setDrawColor(...GOLD_DARK);
  doc.roundedRect(cx - 7.2 * s, cy - 7.8 * s, 14.4 * s, 1.9 * s, 0.7 * s, 0.7 * s, 'FD');
  // Haste e base
  doc.setFillColor(...GOLD);
  doc.rect(cx - 1.1 * s, cy + 3.0 * s, 2.2 * s, 3.2 * s, 'F');
  doc.roundedRect(cx - 4.6 * s, cy + 6.0 * s, 9.2 * s, 1.8 * s, 0.5 * s, 0.5 * s, 'FD');
  doc.roundedRect(cx - 6.4 * s, cy + 7.6 * s, 12.8 * s, 2.4 * s, 0.7 * s, 0.7 * s, 'FD');
  // Estrela discreta na copa
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy - 3.0 * s, 0.9 * s, 'F');
}

/** Pequena estrela (losango de 4 pontas) usada nas faixas. */
function drawStar(doc: jsPDF, cx: number, cy: number, r: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.triangle(cx, cy - r, cx - r * 0.45, cy, cx + r * 0.45, cy, 'F');
  doc.triangle(cx, cy + r, cx - r * 0.45, cy, cx + r * 0.45, cy, 'F');
  doc.triangle(cx - r, cy, cx, cy - r * 0.45, cx, cy + r * 0.45, 'F');
  doc.triangle(cx + r, cy, cx, cy - r * 0.45, cx, cy + r * 0.45, 'F');
}

/** Seta de crescimento (desempenho) em azul. */
function drawGrowthIcon(doc: jsPDF, x: number, y: number, s = 1) {
  doc.setFillColor(...ROYAL);
  doc.rect(x, y + 2.4 * s, 1.5 * s, 2.2 * s, 'F');
  doc.rect(x + 2.2 * s, y + 1.2 * s, 1.5 * s, 3.4 * s, 'F');
  doc.rect(x + 4.4 * s, y, 1.5 * s, 4.6 * s, 'F');
}

/** Alvo (foco) em azul. */
function drawTargetIcon(doc: jsPDF, cx: number, cy: number, r: number) {
  doc.setDrawColor(...ROYAL);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r, 'S');
  doc.circle(cx, cy, r * 0.6, 'S');
  doc.setFillColor(...ROYAL);
  doc.circle(cx, cy, r * 0.22, 'F');
}

const FOOTER_MESSAGES = [
  'CADA PONTO TE APROXIMA DO TOPO!',
  'SUPERE SEUS LIMITES, ALCANCE SEUS SONHOS!',
  'O CONHECIMENTO É O SEU MAIOR PODER!',
  'CONTINUE AVANÇANDO. O MELHOR AINDA ESTÁ POR VIR!',
];

/** Rodapé motivacional em faixa azul escura, dividido em 4 blocos. */
function drawMotivationFooter(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(...NAVY);
  doc.rect(x, y, width, height, 'F');
  doc.setFillColor(...ROYAL);
  doc.rect(x, y, width, 1.1, 'F');

  const block = width / FOOTER_MESSAGES.length;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  FOOTER_MESSAGES.forEach((msg, i) => {
    const bx = x + block * i;
    const cy = y + height / 2;
    if (i > 0) {
      doc.setDrawColor(60, 110, 170);
      doc.setLineWidth(0.3);
      doc.line(bx, y + 2.4, bx, y + height - 2.4);
    }
    drawStar(doc, bx + 5.4, cy, 1.6, [186, 214, 245]);
    doc.text(msg, bx + 9.5, cy + 1.1, { maxWidth: block - 13 });
  });
}

/** Monta o documento da classificação (uma única página A4 paisagem). */
export async function buildIraRankingPdf(entries: RankingEntry[], options: RankingPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const rows = entries.slice(0, RANKING_LIMIT);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 7;

  // Moldura institucional em linhas finas azuis
  doc.setDrawColor(...FRAME);
  doc.setLineWidth(0.8);
  doc.rect(margin - 3, margin - 3, pageWidth - (margin - 3) * 2, pageHeight - (margin - 3) * 2, 'S');
  doc.setLineWidth(0.3);
  doc.rect(margin - 1.6, margin - 1.6, pageWidth - (margin - 1.6) * 2, pageHeight - (margin - 1.6) * 2, 'S');

  // Brasão (canto superior esquerdo), cores originais preservadas
  const logo = await loadLogo(options.logoUrl ?? '');
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin + 1, margin + 1, 30, 30);
    } catch {
      /* ignora logo inválido */
    }
  }

  // Cabeçalho institucional (centro)
  const cx = pageWidth / 2;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(SCHOOL_LINE_1, cx, margin + 7, { align: 'center', charSpace: 0.8 });
  doc.setFontSize(15);
  doc.text(SCHOOL_LINE_2, cx, margin + 14.5, { align: 'center' });

  doc.setDrawColor(...FRAME);
  doc.setLineWidth(0.5);
  doc.line(cx - 52, margin + 17.6, cx + 52, margin + 17.6);

  doc.setFontSize(11);
  doc.text(TITLE_TOP, cx, margin + 24, { align: 'center', charSpace: 0.5 });
  doc.setTextColor(...ROYAL);
  doc.setFontSize(26);
  doc.text(TITLE_MAIN, cx, margin + 36, { align: 'center' });

  // Faixa motivacional central discreta
  const phrase = 'Seu esforço hoje, sua conquista amanhã!';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const phraseWidth = doc.getTextWidth(phrase);
  const chipW = phraseWidth + 16;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(cx - chipW / 2, margin + 39.6, chipW, 7.6, 3.8, 3.8, 'F');
  drawGrowthIcon(doc, cx - chipW / 2 + 4.5, margin + 41.4, 1);
  doc.setTextColor(...NAVY);
  doc.text(phrase, cx - chipW / 2 + 13.5, margin + 44.6);
  doc.setFont('helvetica', 'normal');

  // Troféu dourado (canto superior direito)
  drawGoldenTrophy(doc, pageWidth - margin - 24, margin + 13, 1.15);

  // Bloco motivacional à direita, abaixo do troféu
  const boxW = 62;
  const boxX = pageWidth - margin - boxW - 1;
  const boxY = margin + 27;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...FRAME);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, boxY, boxW, 18, 2, 2, 'FD');
  drawTargetIcon(doc, boxX + 8, boxY + 9, 4.4);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.text('FOCO • DISCIPLINA • DETERMINAÇÃO', boxX + 15, boxY + 7.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...ROYAL);
  doc.text('LÍDERES DE HOJE, INSPIRAÇÃO DE AMANHÃ!', boxX + 15, boxY + 12.6, { maxWidth: boxW - 18 });

  // Metadados discretos (esquerda)
  doc.setTextColor(90, 105, 125);
  doc.setFontSize(7);
  doc.text(
    `Turmas/Séries: ${options.classNames.join(', ')}`,
    margin + 1, margin + 35, { maxWidth: 110 },
  );
  doc.text(
    `Emitido em ${format(new Date(), 'dd/MM/yyyy')}${options.periodsLabel ? ` · Base: ${options.periodsLabel}` : ''} · ${rows.length} de ${options.totalEligible} elegível(is)`,
    margin + 1, margin + 39.5, { maxWidth: 110 },
  );

  // Faixa azul "TOP 15 — MELHORES IRA"
  const bandY = margin + 50;
  const bandH = 9.6;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, bandY, pageWidth - margin * 2, bandH, 1.5, 1.5, 'F');
  doc.setFillColor(...ROYAL);
  doc.roundedRect(margin, bandY + bandH - 2.2, pageWidth - margin * 2, 2.2, 1.1, 1.1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(`TOP ${RANKING_LIMIT} — MELHORES IRA`, cx, bandY + 6.4, { align: 'center', charSpace: 0.6 });
  [cx - 62, cx - 55, pageWidth - margin - 14, pageWidth - margin - 21].forEach((sx) =>
    drawStar(doc, sx, bandY + 4.8, 1.7, [255, 255, 255]));
  drawStar(doc, cx + 55, bandY + 4.8, 1.7, [255, 255, 255]);
  drawStar(doc, cx + 62, bandY + 4.8, 1.7, [255, 255, 255]);

  const footerH = 15;
  const footerY = pageHeight - margin - footerH;

  autoTable(doc, {
    startY: bandY + bandH + 3,
    margin: { left: margin, right: margin, bottom: footerH + margin + 3 },
    head: [['POSIÇÃO', 'CÓDIGO DO ALUNO', 'DATA DE NASCIMENTO', 'TURMA / SÉRIE', 'IRA']],
    body: rows.map((e, i) => [
      `${i + 1}º`,
      formatStudentCode(e.code) || 'não informado',
      formatBirthDate(e.birthDate),
      e.className,
      formatIra(e.ira),
    ]),
    theme: 'grid',
    tableWidth: pageWidth - margin * 2,
    styles: {
      fontSize: 9, cellPadding: 1.35, textColor: [32, 44, 58],
      lineColor: [206, 224, 245], lineWidth: 0.2, valign: 'middle',
    },
    headStyles: {
      fillColor: ROYAL, textColor: 255, fontStyle: 'bold', halign: 'center',
      fontSize: 9, cellPadding: 1.8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { halign: 'center', cellWidth: 34, fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 34, textColor: ROYAL, fontSize: 11 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const place = data.row.index + 1;
      if (place <= 3) {
        data.cell.styles.fillColor = place === 1 ? [214, 233, 255] : place === 2 ? [226, 239, 252] : [235, 244, 253];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = NAVY;
        if (data.column.index === 0) data.cell.text = [`      ${place}º`];
      }
      if (data.column.index === 4) data.cell.styles.textColor = ROYAL;
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0 && data.row.index + 1 <= 3) {
        drawMedal(doc, data.cell.x + 7, data.cell.y + data.cell.height / 2, data.row.index + 1);
      }
    },
  });

  drawMotivationFooter(doc, margin, footerY, pageWidth - margin * 2, footerH);

  return doc;
}

/** Gera e baixa o PDF da classificação. Nenhum nome de aluno é usado. */
export async function generateIraRankingPdf(entries: RankingEntry[], options: RankingPdfOptions) {
  const doc = await buildIraRankingPdf(entries, options);
  doc.save(`classificacao_ira_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
