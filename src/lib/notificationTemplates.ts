export type NotificationStage = 'stage_1' | 'stage_2';

export const STAGE_OPTIONS: { value: NotificationStage; label: string; description: string }[] = [
  {
    value: 'stage_1',
    label: 'Etapa 1 — Comunicação Orientativa (Informal/Documentada)',
    description: 'Utilizada para primeiro atraso ou orientação pedagógica.',
  },
  {
    value: 'stage_2',
    label: 'Etapa 2 — Advertência/Notificação Administrativa Interna',
    description: 'Utilizada em casos de reincidência ou não regularização.',
  },
];

export const OBLIGATION_OPTIONS = [
  'Planejamento pedagógico',
  'Diário de classe',
  'Lançamento de notas',
  'Frequência escolar',
  'Recuperação paralela',
  'Relatórios pedagógicos',
  'Conselho de classe',
  'Fechamento bimestral',
  'Participação em reunião pedagógica',
  'Entrega de atividades avaliativas',
  'Outros',
] as const;

export const STAGE_TITLES: Record<NotificationStage, { title: string; subtitle: string }> = {
  stage_1: {
    title: 'COMUNICAÇÃO ORIENTATIVA',
    subtitle: 'ETAPA 1 — COMUNICAÇÃO ORIENTATIVA (INFORMAL/DOCUMENTADA)',
  },
  stage_2: {
    title: 'NOTIFICAÇÃO ADMINISTRATIVA INTERNA',
    subtitle: 'ETAPA 2 — ADVERTÊNCIA / NOTIFICAÇÃO ADMINISTRATIVA INTERNA',
  },
};

function fmt(date: string | null | undefined): string {
  if (!date) return '____/____/______';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

export interface NotificationData {
  teacher_name: string;
  stage: NotificationStage;
  reason: string;
  obligations: string[];
  other_obligation?: string | null;
  original_deadline: string;
  new_deadline: string;
  classes_subjects?: string | null;
  teacher_justification?: string | null;
}

export function buildNotificationBody(data: NotificationData): string {
  const name = (data.teacher_name || '_______________________').toUpperCase();
  const orig = fmt(data.original_deadline);
  const novo = fmt(data.new_deadline);

  if (data.stage === 'stage_1') {
    return `Prezado(a) Professor(a) ${name},

A Gestão Escolar do Centro de Ensino Professor Antônio Nonato Sampaio vem, por meio desta, registrar orientação referente ao não cumprimento da(s) obrigação(ões) acadêmica(s) abaixo identificada(s), dentro do prazo institucional previamente estabelecido em ${orig}.

Considerando a importância do alinhamento pedagógico e organizacional da unidade escolar, solicitamos a regularização da pendência até o prazo de ${novo}.

Ressaltamos que o cumprimento dos cronogramas acadêmicos é essencial para o acompanhamento pedagógico, consolidação dos registros escolares e organização administrativa da instituição.

Esta comunicação possui caráter orientativo, preventivo e de acompanhamento institucional.`;
  }

  return `Prezado(a) Professor(a) ${name},

A Gestão Escolar do Centro de Ensino Professor Antônio Nonato Sampaio vem, por meio desta, NOTIFICAR Vossa Senhoria acerca do não cumprimento da(s) obrigação(ões) acadêmica(s) relacionadas abaixo, cujo prazo institucional anteriormente estabelecido expirou em ${orig}.

Registra-se que a ausência da regularização compromete os processos pedagógicos, administrativos e o acompanhamento do rendimento escolar dos estudantes.

Dessa forma, fica estabelecido o prazo até ${novo} para regularização da(s) pendência(s), podendo o(a) servidor(a), caso necessário, apresentar justificativa formal.

Esta notificação possui caráter administrativo interno, de acompanhamento funcional e regularização institucional.`;
}

export function getResolvedObligations(data: NotificationData): string[] {
  const list = data.obligations.filter((o) => o !== 'Outros');
  if (data.obligations.includes('Outros') && data.other_obligation?.trim()) {
    list.push(data.other_obligation.trim());
  }
  return list;
}

export function formatDocNumber(num: number, year: number): string {
  return `${String(num).padStart(4, '0')}/${year}`;
}

export function formatDateBR(date: string | null | undefined): string {
  return fmt(date);
}

export function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}