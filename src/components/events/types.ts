export type EventStatus = 'planejado' | 'em_andamento' | 'concluido' | 'arquivado';

export interface SchoolEvent {
  id: string;
  title: string;
  enfoque: string;
  metas: string;
  pontos_atencao: string;
  acoes_estrategicas: string[];
  procedimentos: string[];
  responsaveis: string[];
  prazo_inicio: string | null;
  prazo_fim: string | null;
  is_continuous: boolean;
  status: EventStatus;
  tags: string[];
  resumo_ia: string;
  images: string[]; // storage paths
  pdf_original: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const emptyEvent: Omit<SchoolEvent, 'id' | 'created_at' | 'updated_at' | 'created_by'> = {
  title: '',
  enfoque: '',
  metas: '',
  pontos_atencao: '',
  acoes_estrategicas: [],
  procedimentos: [],
  responsaveis: [],
  prazo_inicio: null,
  prazo_fim: null,
  is_continuous: false,
  status: 'planejado',
  tags: [],
  resumo_ia: '',
  images: [],
  pdf_original: null,
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export const STATUS_COLORS: Record<EventStatus, string> = {
  planejado: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  em_andamento: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  arquivado: 'bg-muted text-muted-foreground border-border',
};

const VALID_STATUS: EventStatus[] = ['planejado', 'em_andamento', 'concluido', 'arquivado'];

function normalizeDate(v: any): string | null {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // try Date.parse for "março de 2026" style or ISO with time
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function asArray(v: any): string[] {
  if (Array.isArray(v)) return v.map(x => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

/**
 * Normalizes raw AI/PDF extraction output into a safe partial event draft.
 * Guarantees: arrays present, dates null or YYYY-MM-DD, status valid.
 */
export function normalizeEventFromAI(raw: any): Partial<Omit<SchoolEvent, 'id' | 'created_at' | 'updated_at' | 'created_by'>> {
  if (!raw || typeof raw !== 'object') return {};
  const status = VALID_STATUS.includes(raw.status) ? raw.status : undefined;
  const out: any = {
    title: typeof raw.title === 'string' ? raw.title.trim() : undefined,
    enfoque: typeof raw.enfoque === 'string' ? raw.enfoque.trim() : '',
    metas: typeof raw.metas === 'string' ? raw.metas.trim() : '',
    pontos_atencao: typeof raw.pontos_atencao === 'string' ? raw.pontos_atencao.trim() : '',
    acoes_estrategicas: asArray(raw.acoes_estrategicas),
    procedimentos: asArray(raw.procedimentos),
    responsaveis: asArray(raw.responsaveis),
    tags: asArray(raw.tags),
    resumo_ia: typeof raw.resumo_ia === 'string' ? raw.resumo_ia.trim() : '',
    prazo_inicio: normalizeDate(raw.prazo_inicio),
    prazo_fim: normalizeDate(raw.prazo_fim),
    is_continuous: typeof raw.is_continuous === 'boolean' ? raw.is_continuous : false,
  };
  if (status) out.status = status;
  // Drop undefined keys so spread doesn't clear existing values
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}

export const FILLABLE_KEYS: (keyof SchoolEvent)[] = [
  'title', 'enfoque', 'metas', 'pontos_atencao',
  'acoes_estrategicas', 'procedimentos', 'responsaveis',
  'prazo_inicio', 'tags', 'resumo_ia',
];

export function countFilled(ev: Partial<SchoolEvent>): { filled: number; total: number } {
  const total = FILLABLE_KEYS.length;
  let filled = 0;
  for (const k of FILLABLE_KEYS) {
    const v: any = (ev as any)[k];
    if (Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && String(v).trim() !== '')) filled++;
  }
  return { filled, total };
}