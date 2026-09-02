import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { chunk, classifyPushResponse, PushDevice, sendWebPush } from "./webpush.ts";

export type AppRole = "admin" | "direction" | "teacher" | "staff";

export const EVENT_AUDIENCE: Record<string, AppRole[]> = {
  medical_certificate_created: ["admin", "direction", "teacher", "staff"],
  management_announcement: ["admin", "direction", "teacher", "staff"],
  school_event_published: ["admin", "direction", "teacher", "staff"],
  grades_import_finished: ["admin", "direction"],
  planning_deadline: ["admin", "direction"],
  new_user_signup: ["admin", "direction"],
};

/** Eventos em que a central interna não pode ser desligada pelo usuário. */
export const MANDATORY_INAPP_EVENTS = new Set<string>([
  "medical_certificate_created",
]);

export interface NotificationContent {
  title: string;
  body: string;
  route: string;
  severity: "info" | "warning" | "critical";
}

const DEFAULT_ROUTE = "/dashboard";

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function safeRoute(route: unknown): string {
  if (typeof route !== "string") return DEFAULT_ROUTE;
  const value = route.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_ROUTE;
  return value;
}

/**
 * Conteúdo por tipo de evento. Eventos sensíveis (atestado) IGNORAM o contexto
 * enviado pelo cliente — nada de nome do aluno, CID, datas ou anexos.
 */
export function buildNotificationContent(
  eventType: string,
  context: Record<string, unknown> = {},
): NotificationContent {
  switch (eventType) {
    case "medical_certificate_created":
      return {
        title: "Novo atestado registrado",
        body: "Um novo atestado foi registrado para um aluno da escola.",
        route: "/students",
        severity: "info",
      };
    case "management_announcement":
      return {
        title: sanitizeText(context.title) || "Aviso da gestão escolar",
        body: sanitizeText(context.body) || "Há um novo aviso da gestão escolar.",
        route: safeRoute(context.route),
        severity: "info",
      };
    case "school_event_published":
      return {
        title: "Novo evento escolar",
        body: sanitizeText(context.title) || "Um novo evento/projeto foi publicado.",
        route: safeRoute(context.route ?? "/school-events"),
        severity: "info",
      };
    case "grades_import_finished":
      return {
        title: "Importação de boletim concluída",
        body: sanitizeText(context.body) || "A importação de notas foi finalizada.",
        route: safeRoute(context.route ?? "/classes"),
        severity: "info",
      };
    case "planning_deadline":
      return {
        title: "Notificação docente emitida",
        body: sanitizeText(context.body) || "Uma notificação docente foi registrada.",
        route: safeRoute(context.route ?? "/teacher-notifications"),
        severity: "warning",
      };
    case "new_user_signup":
      return {
        title: "Novo usuário cadastrado",
        body: sanitizeText(context.body) || "Um novo usuário criou uma conta no EDUNEXUS.",
        route: safeRoute(context.route ?? "/settings"),
        severity: "info",
      };
    case "push_test":
      return {
        title: "Teste de notificação — EDUNEXUS",
        body: "As notificações push estão funcionando neste dispositivo.",
        route: "/notifications",
        severity: "info",
      };
    default:
      return {
        title: sanitizeText(context.title) || "EDUNEXUS",
        body: sanitizeText(context.body) || "Você tem uma nova notificação.",
        route: safeRoute(context.route),
        severity: "info",
      };
  }
}

export function buildDedupeKey(
  eventType: string,
  entityId: string | null | undefined,
  version = "v1",
): string {
  return `${eventType}:${entityId ?? "none"}:${version}`;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Resolve a audiência no servidor a partir dos VÍNCULOS ATIVOS da escola.
 *
 * `user_roles` (global) NUNCA é usado como audiência: um professor/direção só
 * recebe notificações da escola em que possui membership ativo.
 */
export async function resolveAudience(
  admin: SupabaseClient,
  eventType: string,
  schoolId: string | null,
  extraUserIds: string[] = [],
): Promise<string[]> {
  const roles = EVENT_AUDIENCE[eventType] ?? [];
  const ids = new Set<string>(extraUserIds.filter(Boolean));

  if (roles.length && schoolId) {
    const { data, error } = await admin
      .from("school_memberships")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .in("role", roles);
    if (error) throw error;
    for (const row of data ?? []) ids.add((row as { user_id: string }).user_id);
  }
  return [...ids];
}

/** Papel efetivo do usuário NA escola informada (`null` se não houver vínculo ativo). */
export async function schoolRoleOf(
  admin: SupabaseClient,
  userId: string,
  schoolId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("school_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return (data as { role: string } | null)?.role ?? null;
}

/** Admin global (tabela user_roles) — mantido apenas para administração. */
export async function isGlobalAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export interface NotifyResult {
  notification_id: string;
  deduped: boolean;
  recipients: number;
  push_sent: number;
  push_failed: number;
  push_expired: number;
}

/**
 * Cria a notificação (idempotente por dedupe_key), grava recipients na central
 * interna e envia Web Push aos devices ativos que aceitam o evento.
 */
export async function dispatchNotification(opts: {
  admin: SupabaseClient;
  eventType: string;
  entityId?: string | null;
  entityType?: string | null;
  schoolId?: string | null;
  createdBy?: string | null;
  context?: Record<string, unknown>;
  userIds: string[];
  dedupeVersion?: string;
  /** Restringe o push a um único device (usado pelo teste). */
  onlyDeviceId?: string | null;
}): Promise<NotifyResult> {
  const {
    admin,
    eventType,
    entityId = null,
    entityType = null,
    schoolId = null,
    createdBy = null,
    context = {},
    userIds,
    dedupeVersion = "v1",
    onlyDeviceId = null,
  } = opts;

  const content = buildNotificationContent(eventType, context);
  const dedupeKey = buildDedupeKey(eventType, entityId, dedupeVersion);

  let deduped = false;
  const { data: inserted, error: insertError } = await admin
    .from("notifications")
    .insert({
      school_id: schoolId,
      event_type: eventType,
      title: content.title,
      body: content.body,
      route: content.route,
      entity_type: entityType,
      entity_id: entityId,
      severity: content.severity,
      created_by: createdBy,
      dedupe_key: dedupeKey,
    })
    .select("id")
    .maybeSingle();

  let notificationId = inserted?.id as string | undefined;

  if (insertError) {
    if (insertError.code !== "23505") throw insertError;
    deduped = true;
    const { data: existing, error: selError } = await admin
      .from("notifications")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (selError) throw selError;
    notificationId = existing?.id as string | undefined;
  }
  if (!notificationId) throw new Error("Falha ao criar notificação");

  // preferências (linha ausente = habilitado)
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, push_enabled, inapp_enabled")
    .eq("event_type", eventType)
    .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const prefMap = new Map<string, { push_enabled: boolean; inapp_enabled: boolean }>();
  for (const p of prefs ?? []) {
    const row = p as { user_id: string; push_enabled: boolean; inapp_enabled: boolean };
    prefMap.set(row.user_id, { push_enabled: row.push_enabled, inapp_enabled: row.inapp_enabled });
  }

  // Central interna OBRIGATÓRIA para eventos críticos de compliance:
  // novo atestado sempre chega a toda a audiência, independente da preferência.
  const inappUsers = MANDATORY_INAPP_EVENTS.has(eventType)
    ? [...userIds]
    : userIds.filter((id) => prefMap.get(id)?.inapp_enabled !== false);
  const pushUsers = userIds.filter((id) => prefMap.get(id)?.push_enabled !== false);

  if (inappUsers.length) {
    const { error: recError } = await admin
      .from("notification_recipients")
      .upsert(
        inappUsers.map((user_id) => ({ notification_id: notificationId, user_id })),
        { onConflict: "notification_id,user_id", ignoreDuplicates: true },
      );
    if (recError) throw recError;
  }

  const result: NotifyResult = {
    notification_id: notificationId,
    deduped,
    recipients: inappUsers.length,
    push_sent: 0,
    push_failed: 0,
    push_expired: 0,
  };

  if (!pushUsers.length) return result;

  let deviceQuery = admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, failure_count, disabled_at")
    .in("user_id", pushUsers)
    .is("disabled_at", null);
  if (onlyDeviceId) deviceQuery = deviceQuery.eq("id", onlyDeviceId);

  const { data: devices, error: devError } = await deviceQuery;
  if (devError) throw devError;

  for (const batch of chunk((devices ?? []) as PushDevice[], 100)) {
    await Promise.all(
      batch.map(async (device) => {
        let send;
        try {
          send = await sendWebPush(device, {
            title: content.title,
            body: content.body,
            url: content.route,
            notification_id: notificationId,
          });
        } catch (e) {
          send = { ok: false, httpStatus: 500, error: String(e).slice(0, 500) };
        }

        const status = send.ok ? "sent" : classifyPushResponse(send.httpStatus);
        if (status === "sent") result.push_sent++;
        else if (status === "expired") result.push_expired++;
        else result.push_failed++;

        try {
          await admin.from("notification_deliveries").upsert(
            {
              notification_id: notificationId,
              user_id: device.user_id,
              device_id: device.id,
              status,
              attempts: 1,
              http_status: send.httpStatus || null,
              last_error: send.error ?? null,
              sent_at: status === "sent" ? new Date().toISOString() : null,
            },
            { onConflict: "notification_id,device_id" },
          );

          if (status === "expired") {
            await admin
              .from("push_subscriptions")
              .update({
                disabled_at: new Date().toISOString(),
                failure_count: (device.failure_count ?? 0) + 1,
              })
              .eq("id", device.id);
          } else if (status === "failed") {
            const failures = (device.failure_count ?? 0) + 1;
            await admin
              .from("push_subscriptions")
              .update({
                failure_count: failures,
                disabled_at: failures >= 10 ? new Date().toISOString() : null,
              })
              .eq("id", device.id);
          } else {
            await admin
              .from("push_subscriptions")
              .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
              .eq("id", device.id);
          }
        } catch (e) {
          console.error("Falha ao registrar delivery:", e);
        }
      }),
    );
  }

  return result;
}
