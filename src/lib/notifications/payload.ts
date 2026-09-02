import type { NotificationEventType } from './events';

export const DEFAULT_ROUTE = '/dashboard';

/** Campos que NUNCA podem sair do banco para um payload de notificação. */
export const FORBIDDEN_PAYLOAD_FIELDS = [
  'student_name',
  'full_name',
  'cid_code',
  'cid_description',
  'diagnosis',
  'notes',
  'issuer',
  'attachment_path',
  'start_date',
  'end_date',
] as const;

export interface NotificationContent {
  title: string;
  body: string;
  route: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface NotificationContext {
  /** Texto curto, já público, usado por eventos que permitem detalhe (avisos, eventos). */
  title?: string | null;
  body?: string | null;
  route?: string | null;
}

/**
 * Conteúdo determinístico por tipo de evento.
 * Eventos sensíveis (atestado) ignoram totalmente o contexto recebido.
 */
export function buildNotificationContent(
  eventType: NotificationEventType | string,
  context: NotificationContext = {},
): NotificationContent {
  switch (eventType) {
    case 'medical_certificate_created':
      return {
        title: 'Novo atestado registrado',
        body: 'Um novo atestado foi registrado para um aluno da escola.',
        route: '/students',
        severity: 'info',
      };
    case 'management_announcement':
      return {
        title: sanitizeText(context.title) || 'Aviso da gestão escolar',
        body: sanitizeText(context.body) || 'Há um novo aviso da gestão escolar.',
        route: safeRoute(context.route),
        severity: 'info',
      };
    case 'school_event_published':
      return {
        title: 'Novo evento escolar',
        body: sanitizeText(context.title) || 'Um novo evento/projeto foi publicado.',
        route: safeRoute(context.route ?? '/school-events'),
        severity: 'info',
      };
    case 'grades_import_finished':
      return {
        title: 'Importação de boletim concluída',
        body: sanitizeText(context.body) || 'A importação de notas foi finalizada.',
        route: safeRoute(context.route ?? '/classes'),
        severity: 'info',
      };
    case 'planning_deadline':
      return {
        title: 'Notificação docente emitida',
        body: sanitizeText(context.body) || 'Uma notificação docente foi registrada.',
        route: safeRoute(context.route ?? '/teacher-notifications'),
        severity: 'warning',
      };
    case 'new_user_signup':
      return {
        title: 'Novo usuário cadastrado',
        body: sanitizeText(context.body) || 'Um novo usuário criou uma conta no EDUNEXUS.',
        route: safeRoute(context.route ?? '/settings'),
        severity: 'info',
      };
    case 'push_test':
      return {
        title: 'Teste de notificação — EDUNEXUS',
        body: 'As notificações push estão funcionando neste dispositivo.',
        route: safeRoute(context.route ?? '/notifications'),
        severity: 'info',
      };
    default:
      return {
        title: sanitizeText(context.title) || 'EDUNEXUS',
        body: sanitizeText(context.body) || 'Você tem uma nova notificação.',
        route: safeRoute(context.route),
        severity: 'info',
      };
  }
}

export function sanitizeText(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 180);
}

/** Rotas devem ser caminhos internos; qualquer coisa externa cai no fallback. */
export function safeRoute(route: string | null | undefined): string {
  if (!route) return DEFAULT_ROUTE;
  const value = String(route).trim();
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_ROUTE;
  return value;
}

/**
 * dedupe_key determinístico: mesmo evento + escola + entidade nunca duplica.
 * A escola faz parte da chave para que escolas diferentes nunca colidam.
 */
export function buildDedupeKey(
  eventType: string,
  entityId: string | null | undefined,
  schoolId: string | null | undefined = null,
  version = 'v1',
): string {
  return `${eventType}:${schoolId ?? 'global'}:${entityId ?? 'none'}:${version}`;
}

/** Garante que nenhum termo sensível vazou para o payload final. */
export function containsSensitiveValue(
  payload: Record<string, unknown>,
  sensitiveValues: (string | null | undefined)[],
): boolean {
  const haystack = JSON.stringify(payload).toLowerCase();
  return sensitiveValues.some((v) => {
    const needle = (v ?? '').toString().trim().toLowerCase();
    return needle.length >= 3 && haystack.includes(needle);
  });
}
