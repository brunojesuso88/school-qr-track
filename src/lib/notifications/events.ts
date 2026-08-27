export type AppRole = 'admin' | 'direction' | 'teacher' | 'staff';

export type NotificationEventType =
  | 'medical_certificate_created'
  | 'management_announcement'
  | 'school_event_published'
  | 'new_user_signup'
  | 'grades_import_finished'
  | 'planning_deadline'
  | 'push_test';

export interface NotificationEventDefinition {
  type: NotificationEventType;
  label: string;
  description: string;
  /** Papéis que recebem o evento por padrão (resolvido SEMPRE no servidor). */
  roles: AppRole[];
  /** Eventos internos/pontuais não aparecem na tela de preferências. */
  configurable: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  {
    type: 'medical_certificate_created',
    label: 'Novo atestado registrado',
    description: 'Aviso genérico quando um atestado é cadastrado (sem dados médicos).',
    roles: ['admin', 'direction', 'teacher', 'staff'],
    configurable: true,
  },
  {
    type: 'management_announcement',
    label: 'Avisos da gestão',
    description: 'Comunicados enviados pela gestão escolar.',
    roles: ['admin', 'direction', 'teacher', 'staff'],
    configurable: true,
  },
  {
    type: 'school_event_published',
    label: 'Eventos escolares',
    description: 'Publicação de novos eventos e projetos da escola.',
    roles: ['admin', 'direction', 'teacher', 'staff'],
    configurable: true,
  },
  {
    type: 'grades_import_finished',
    label: 'Importação de boletim concluída',
    description: 'Conclusão da importação de notas de uma turma.',
    roles: ['admin', 'direction'],
    configurable: true,
  },
  {
    type: 'planning_deadline',
    label: 'Notificação docente / prazos',
    description: 'Emissão de notificação docente e prazos de planejamento.',
    roles: ['admin', 'direction'],
    configurable: true,
  },
  {
    type: 'new_user_signup',
    label: 'Novos cadastros de usuários',
    description: 'Aviso para administradores quando alguém cria uma conta.',
    roles: ['admin'],
    configurable: true,
  },
  {
    type: 'push_test',
    label: 'Notificação de teste',
    description: 'Envio manual de teste para o próprio dispositivo.',
    roles: ['admin', 'direction', 'teacher', 'staff'],
    configurable: false,
  },
];

/** Eventos cuja entrega na central interna é obrigatória (switch travado). */
export const MANDATORY_INAPP_EVENTS: NotificationEventType[] = [
  'medical_certificate_created',
];

export function isInappMandatory(type: string): boolean {
  return MANDATORY_INAPP_EVENTS.includes(type as NotificationEventType);
}

export const CONFIGURABLE_EVENTS = NOTIFICATION_EVENTS.filter((e) => e.configurable);

export function getEventDefinition(
  type: string,
): NotificationEventDefinition | undefined {
  return NOTIFICATION_EVENTS.find((e) => e.type === type);
}

/** Papéis que devem receber o evento. Nunca usar o role do cliente para isso. */
export function audienceRolesForEvent(type: string): AppRole[] {
  return getEventDefinition(type)?.roles ?? [];
}
