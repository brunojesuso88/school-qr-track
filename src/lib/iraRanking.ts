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
import { HighSchoolSeries } from '@/lib/series';

export const RANKING_LIMIT = 15;

/** Séries do Ensino Médio aceitas na classificação. */
export type { HighSchoolSeries } from '@/lib/series';
export { CLASS_SERIES_OPTIONS, classSeriesLabel, parseSeriesValue, normalizeSeriesList, seriesListMatches } from '@/lib/series';

export const HIGH_SCHOOL_SERIES: { value: HighSchoolSeries; label: string }[] = [
  { value: '1', label: '1ª Série do Ensino Médio' },
  { value: '2', label: '2ª Série do Ensino Médio' },
  { value: '3', label: '3ª Série do Ensino Médio' },
];

export const seriesLabel = (s: HighSchoolSeries) =>
  HIGH_SCHOOL_SERIES.find((o) => o.value === s)!.label;

/** Normaliza o valor persistido em `classes.series` para o tipo da série. */
export const parseClassSeries = (value: string | null | undefined): HighSchoolSeries | null =>
  value === '1' || value === '2' || value === '3' ? value : null;

/**
 * Detecta a série do Ensino Médio pelo nome da turma (fallback seguro).
 * Retorna `null` quando não há indicação clara ou quando há indicação ambígua
 * (mais de uma série citada no mesmo nome).
 */
export function detectClassSeries(className: string): HighSchoolSeries | null {
  const n = className.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const found = new Set<HighSchoolSeries>();
  const re = /(^|[^0-9])([123])\s*(a|o|º|ª|\.)?\s*(serie|ser|ano|em)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) {
    // Exige marcador ordinal (1ª/1º/1a/1o) ou palavra (serie/ano/em)
    if (m[3] || m[4]) found.add(m[2] as HighSchoolSeries);
  }
  if (found.size !== 1) {
    if (found.size > 1) {
      console.warn(`[IRA Ranking] Turma com série ambígua, ignorada: "${className}"`);
    }
    return null;
  }
  return [...found][0];
}

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
    supabase.from('grade_subjects').select('*').in('class_id', classIds).eq('legacy_excluded', false).order('sort_order'),
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
  /** Série do Ensino Médio da classificação (obrigatória no fluxo da UI). */
  series?: HighSchoolSeries;
}

const SCHOOL_LINE_1 = 'CENTRO DE ENSINO';
const SCHOOL_LINE_2 = 'PROFESSOR ANTÔNIO NONATO SAMPAIO';
const TITLE_TOP = 'CLASSIFICAÇÃO DE DESEMPENHO';
const TITLE_MAIN = 'RANKING DO IRA';

const NAVY: [number, number, number] = [10, 46, 92];
const ROYAL: [number, number, number] = [21, 101, 192];
const LIGHT: [number, number, number] = [232, 241, 252];
const FRAME: [number, number, number] = [176, 202, 232];

/** Carrega uma imagem como dataURL (falha silenciosa, nunca quebra o PDF). */
async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
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

/** Detecta o formato aceito pelo jsPDF a partir do dataURL. */
const imageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' =>
  /^data:image\/(jpe?g)/i.test(dataUrl) ? 'JPEG' : /^data:image\/webp/i.test(dataUrl) ? 'WEBP' : 'PNG';

/** Insere a imagem encaixada proporcionalmente dentro de um box (sem deformar). */
function drawFittedImage(doc: jsPDF, dataUrl: string, x: number, y: number, box: number) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.width && props.height ? props.width / props.height : 1;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    doc.addImage(dataUrl, imageFormat(dataUrl), x + (box - w) / 2, y + (box - h) / 2, w, h);
  } catch {
    /* imagem inválida — segue sem ela */
  }
}

/** Pequena estrela (losango de 4 pontas) usada nas faixas. */
function drawStar(doc: jsPDF, cx: number, cy: number, r: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.triangle(cx, cy - r, cx - r * 0.45, cy, cx + r * 0.45, cy, 'F');
  doc.triangle(cx, cy + r, cx - r * 0.45, cy, cx + r * 0.45, cy, 'F');
  doc.triangle(cx - r, cy, cx, cy - r * 0.45, cx, cy + r * 0.45, 'F');
  doc.triangle(cx + r, cy, cx, cy - r * 0.45, cx, cy + r * 0.45, 'F');
}

/** Única frase motivacional exibida no rodapé do PDF. */
export const FOOTER_MESSAGE = 'Você não precisa ser melhor que ninguém para ser o melhor de si';

/** Rodapé motivacional: faixa única, elegante, com a frase centralizada. */
function drawMotivationFooter(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'F');
  doc.setFillColor(...ROYAL);
  doc.roundedRect(x, y, width, 1.4, 0.7, 0.7, 'F');

  const cy = y + height / 2 + 1.4;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  // Reduz a fonte até a frase caber com folga para as estrelas laterais.
  const available = width - 34;
  let size = 11.5;
  doc.setFontSize(size);
  while (size > 9 && doc.getTextWidth(FOOTER_MESSAGE) > available) {
    size -= 0.25;
    doc.setFontSize(size);
  }
  const cxF = x + width / 2;
  doc.text(FOOTER_MESSAGE, cxF, cy, { align: 'center' });

  const baseW = doc.getTextWidth(FOOTER_MESSAGE);
  const starY = y + height / 2 + 0.4;
  drawStar(doc, cxF - baseW / 2 - 7, starY, 1.8, [186, 214, 245]);
  drawStar(doc, cxF + baseW / 2 + 7, starY, 1.8, [186, 214, 245]);
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

  // Brasão (canto superior esquerdo) e mascote (canto superior direito).
  const LOGO_BOX = 46;
  const MASCOT_BOX = 40; // ~40 mm
  const [logo, mascot] = await Promise.all([
    loadImageDataUrl(options.logoUrl ?? ''),
    loadImageDataUrl(mascotAsset),
  ]);
  if (logo) drawFittedImage(doc, logo, margin + 1, margin + 1, LOGO_BOX);
  if (mascot) drawFittedImage(doc, mascot, pageWidth - margin - 1 - MASCOT_BOX, margin + 1, MASCOT_BOX);

  // Cabeçalho institucional — bloco de texto entre o brasão (esq.) e o mascote (dir.)
  const cx = pageWidth / 2;
  const textLeft = margin + 1 + LOGO_BOX + 4;
  const textRight = pageWidth - margin - 1 - MASCOT_BOX - 4;
  const cxT = (textLeft + textRight) / 2;
  const textWidth = textRight - textLeft;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(SCHOOL_LINE_1, cxT, margin + 8, { align: 'center', charSpace: 0.8 });
  doc.setFontSize(14);
  doc.text(SCHOOL_LINE_2, cxT, margin + 15.5, { align: 'center' });

  doc.setDrawColor(...FRAME);
  doc.setLineWidth(0.5);
  doc.line(cxT - 52, margin + 18.4, cxT + 52, margin + 18.4);

  doc.setFontSize(10.5);
  doc.text(TITLE_TOP, cxT, margin + 24.5, { align: 'center', charSpace: 0.5 });
  doc.setTextColor(...ROYAL);
  doc.setFontSize(16);
  const mainTitle = options.series
    ? `${TITLE_MAIN} — ${options.series}ª SÉRIE DO ENSINO MÉDIO`
    : TITLE_MAIN;
  doc.text(mainTitle, cxT, margin + 34, { align: 'center' });
  doc.setDrawColor(...ROYAL);
  doc.setLineWidth(0.8);
  const underline = doc.getTextWidth(mainTitle) / 2 + 3;
  doc.line(cxT - underline, margin + 36.6, cxT + underline, margin + 36.6);

  doc.setFont('helvetica', 'normal');

  // Bloco "Turmas/Séries" (rótulo + nomes com quebra automática) e data de emissão.
  doc.setTextColor(90, 105, 125);
  doc.setFontSize(7.4);
  doc.setFont('helvetica', 'bold');
  let infoY = margin + 41.5;
  doc.text('Turmas/Séries:', cxT, infoY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  const classLines = doc.splitTextToSize(
    options.classNames.join(', ') || '—',
    Math.max(60, textWidth),
  ) as string[];
  classLines.forEach((line) => {
    infoY += 3.6;
    doc.text(line, cxT, infoY, { align: 'center' });
  });
  infoY += 4.4;
  doc.text(`Emitido em ${format(new Date(), 'dd/MM/yyyy')}`, cxT, infoY, { align: 'center' });

  // Faixa azul "OS TOP 15 - MELHORES IRA" (empurrada conforme a altura do bloco acima)
  const bandY = Math.max(margin + 51, infoY + 4);
  const bandH = 9.6;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, bandY, pageWidth - margin * 2, bandH, 1.5, 1.5, 'F');
  doc.setFillColor(...ROYAL);
  doc.roundedRect(margin, bandY + bandH - 2.2, pageWidth - margin * 2, 2.2, 1.1, 1.1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  // Hierarquia: "OS TOP 15" maior, "- MELHORES IRA" menor, na mesma faixa.
  const strong = `OS TOP ${RANKING_LIMIT}`;
  const weak = '- MELHORES IRA';
  doc.setFontSize(13.5);
  const strongW = doc.getTextWidth(`${strong} `);
  doc.setFontSize(10);
  const weakW = doc.getTextWidth(weak);
  const totalW = strongW + weakW;
  const bandTextY = bandY + 6.3;
  const startX = cx - totalW / 2;
  doc.setFontSize(13.5);
  doc.text(strong, startX, bandTextY);
  doc.setFontSize(10);
  doc.text(weak, startX + strongW, bandTextY);
  drawStar(doc, startX - 8, bandY + 4.6, 1.7, [255, 255, 255]);
  drawStar(doc, startX + totalW + 8, bandY + 4.6, 1.7, [255, 255, 255]);

  const footerH = 13;
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
      fontSize: 8.6, cellPadding: 1.15, textColor: [32, 44, 58],
      lineColor: [206, 224, 245], lineWidth: 0.2, valign: 'middle',
    },
    headStyles: {
      fillColor: ROYAL, textColor: 255, fontStyle: 'bold', halign: 'center',
      fontSize: 8.6, cellPadding: 1.5,
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
