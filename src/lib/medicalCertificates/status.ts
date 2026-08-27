/**
 * Regras puras de atestados médicos.
 * Não altera registros de presença; apenas deriva status e cobertura.
 */

export type CertificateStatusManual = 'active' | 'cancelled';

export type DerivedCertificateStatus = 'cancelled' | 'future' | 'active' | 'ended';

export interface CertificatePeriod {
  start_date: string; // yyyy-MM-dd
  end_date: string; // yyyy-MM-dd
  status_manual?: CertificateStatusManual | string | null;
}

export const DERIVED_STATUS_LABEL: Record<DerivedCertificateStatus, string> = {
  cancelled: 'Cancelado',
  future: 'Futuro',
  active: 'Ativo',
  ended: 'Encerrado',
};

/** Converte Date -> 'yyyy-MM-dd' sem deslocamento de timezone. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Comparação de datas ISO (yyyy-MM-dd) é lexicográfica e segura. */
export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function derivedStatus(
  certificate: CertificatePeriod,
  today: string = toDateKey(new Date()),
): DerivedCertificateStatus {
  if (certificate.status_manual === 'cancelled') return 'cancelled';
  if (today < certificate.start_date) return 'future';
  if (today > certificate.end_date) return 'ended';
  return 'active';
}

/** Dias corridos, inclusivo nas duas pontas. */
export function durationInDays(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

export function areDatesValid(start: string, end: string): boolean {
  if (!start || !end) return false;
  return end >= start;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Verifica sobreposição com atestados ATIVOS existentes (cancelados são ignorados).
 * `excludeId` permite editar o próprio registro.
 */
export function findActiveOverlap<T extends CertificatePeriod & { id?: string }>(
  existing: T[],
  candidate: { start_date: string; end_date: string; id?: string },
): T | null {
  for (const c of existing) {
    if (c.status_manual === 'cancelled') continue;
    if (candidate.id && c.id === candidate.id) continue;
    if (rangesOverlap(c.start_date, c.end_date, candidate.start_date, candidate.end_date)) return c;
  }
  return null;
}

export const OVERLAP_MESSAGE =
  'Já existe um atestado ativo que abrange parte desse período. Edite ou cancele o registro existente.';

/** Mapa de cobertura: chave `${student_id}|${yyyy-MM-dd}` -> true */
export type CoverageMap = Set<string>;

export function coverageKey(studentId: string, date: string): string {
  return `${studentId}|${date}`;
}

export interface CoverageRow {
  student_id: string;
  start_date: string;
  end_date: string;
  status?: string | null;
}

/** Constrói o Set de cobertura a partir das linhas retornadas pela RPC segura. */
export function buildCoverageMap(rows: CoverageRow[], dates: string[]): CoverageMap {
  const map: CoverageMap = new Set();
  for (const row of rows) {
    if (row.status && row.status !== 'active') continue;
    for (const date of dates) {
      if (isDateInRange(date, row.start_date, row.end_date)) {
        map.add(coverageKey(row.student_id, date));
      }
    }
  }
  return map;
}

/** Linha mínima da RPC `get_certificate_coverage_flags`: sem período, sem CID. */
export interface CoverageFlagRow {
  student_id: string;
  date: string;
  covered: boolean;
}

/**
 * Constrói o Set de cobertura a partir de flags booleanas.
 * Usado nos relatórios para os quatro perfis — nunca expõe start/end/CID.
 */
export function buildCoverageMapFromFlags(rows: CoverageFlagRow[]): CoverageMap {
  const map: CoverageMap = new Set();
  for (const row of rows) {
    if (!row.covered) continue;
    map.add(coverageKey(row.student_id, row.date));
  }
  return map;
}


export function isCovered(map: CoverageMap, studentId: string, date: string): boolean {
  return map.has(coverageKey(studentId, date));
}

/**
 * Rótulo exibido em relatórios. Nunca converte presença em falta
 * e nunca sobrescreve um status justificado por outro motivo.
 */
export function attendanceDisplayLabel(status: string, covered: boolean): string {
  if (status === 'absent') return covered ? 'Ausente — Atestado' : 'Ausente';
  if (status === 'justified') return covered ? 'Justificado — Atestado' : 'Justificado';
  if (status === 'present') return 'Presente';
  return status;
}

export interface AbsenceBreakdown {
  totalAbsent: number;
  withCertificate: number;
  withoutCertificate: number;
}

export function absenceBreakdown(
  records: { student_id: string; date: string; status: string }[],
  coverage: CoverageMap,
): AbsenceBreakdown {
  let totalAbsent = 0;
  let withCertificate = 0;
  for (const r of records) {
    if (r.status !== 'absent') continue;
    totalAbsent += 1;
    if (isCovered(coverage, r.student_id, r.date)) withCertificate += 1;
  }
  return { totalAbsent, withCertificate, withoutCertificate: totalAbsent - withCertificate };
}
