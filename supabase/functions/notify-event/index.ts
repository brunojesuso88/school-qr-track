import { requireAuth } from "../_shared/auth.ts";
import {
  dispatchNotification, EVENT_AUDIENCE, isGlobalAdmin, resolveAudience, schoolRoleOf, serviceClient,
} from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Quem pode DISPARAR cada evento (audiência é sempre resolvida no servidor). */
const EVENT_TRIGGER_ROLES: Record<string, string[]> = {
  medical_certificate_created: ["admin", "direction", "teacher"],
  management_announcement: ["admin", "direction"],
  school_event_published: ["admin", "direction", "teacher"],
  grades_import_finished: ["admin", "direction", "teacher"],
  planning_deadline: ["admin", "direction"],
  push_test: ["admin", "direction", "teacher", "staff"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const eventType = typeof body.event_type === "string" ? body.event_type : "";
    if (!eventType) return json({ success: false, error: "event_type é obrigatório" }, 400);

    const allowedTriggerRoles = EVENT_TRIGGER_ROLES[eventType];
    if (!allowedTriggerRoles) {
      return json({ success: false, error: "event_type não suportado" }, 400);
    }

    const admin = serviceClient();

    const entityId = typeof body.entity_id === "string" ? body.entity_id : null;
    const entityType = typeof body.entity_type === "string" ? body.entity_type : null;
    const schoolId = typeof body.school_id === "string" ? body.school_id : null;

    // Autorização SEMPRE na escola alvo: papel efetivo lido no servidor.
    const globalAdmin = await isGlobalAdmin(admin, auth.userId);
    if (eventType !== "push_test") {
      if (!schoolId) return json({ success: false, error: "school_id é obrigatório" }, 400);
      const callerRole = await schoolRoleOf(admin, auth.userId, schoolId);
      const allowed = globalAdmin
        || (callerRole !== null && allowedTriggerRoles.includes(callerRole));
      if (!allowed) return json({ success: false, error: "Forbidden" }, 403);
    }
    const context = (body.context && typeof body.context === "object")
      ? body.context as Record<string, unknown>
      : {};

    // push_test: somente o próprio usuário / device atual.
    if (eventType === "push_test") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
      if (!endpoint) return json({ success: false, error: "endpoint é obrigatório" }, 400);

      // O mesmo endpoint pode estar vinculado a mais de uma escola do usuário.
      const { data: devices } = await admin
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", endpoint)
        .eq("user_id", auth.userId)
        .limit(1);
      const device = (devices ?? [])[0] ?? null;
      if (!device) {
        return json({ success: false, error: "Dispositivo não encontrado para este usuário" }, 404);
      }

      const result = await dispatchNotification({
        admin,
        eventType,
        entityId: `${auth.userId}:${Date.now()}`,
        entityType: "push_test",
        createdBy: auth.userId,
        userIds: [auth.userId],
        onlyDeviceId: device.id as string,
        context,
      });
      return json({ success: true, ...result });
    }

    if (!EVENT_AUDIENCE[eventType]) {
      return json({ success: false, error: "Audiência não definida para o evento" }, 400);
    }

    const extraUsers = Array.isArray(body.extra_user_ids)
      ? (body.extra_user_ids as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

    const userIds = await resolveAudience(admin, eventType, schoolId, extraUsers);
    if (!userIds.length) {
      return json({ success: true, notification_id: null, recipients: 0, push_sent: 0 });
    }

    const result = await dispatchNotification({
      admin,
      eventType,
      entityId,
      entityType,
      schoolId,
      createdBy: auth.userId,
      context,
      userIds,
    });

    return json({ success: true, ...result });
  } catch (error) {
    console.error("notify-event error:", error);
    return json({ success: false, error: String((error as Error)?.message ?? error) }, 500);
  }
});
