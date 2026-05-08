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