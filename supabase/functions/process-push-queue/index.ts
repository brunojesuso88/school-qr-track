import { requireAuth } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/notify.ts";
import { chunk, classifyPushResponse, PushDevice, sendWebPush } from "../_shared/webpush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 3;

/**
 * Retry das entregas com status "failed" que ainda não esgotaram as 3 tentativas.
 * Invocável manualmente por admin/direção; nenhum scheduler está ativo hoje.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const admin = serviceClient();

    // Escopo: a fila só processa entregas das escolas em que o usuário é
    // admin/direção (admin global processa todas). Nunca papel global isolado.
    const { data: globalAdmin } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isGlobal = Boolean(globalAdmin);

    let managedSchools: string[] = [];
    if (!isGlobal) {
      const { data: memberships, error: memErr } = await admin
        .from("school_memberships")
        .select("school_id")
        .eq("user_id", auth.userId)
        .eq("status", "active")
        .in("role", ["admin", "direction"]);
      if (memErr) throw memErr;
      managedSchools = (memberships ?? []).map((m) => (m as { school_id: string }).school_id);
      if (!managedSchools.length) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    let notificationIds: string[] | null = null;
    if (!isGlobal) {
      const { data: notifs, error: notifErr } = await admin
        .from("notifications")
        .select("id")
        .in("school_id", managedSchools);
      if (notifErr) throw notifErr;
      notificationIds = (notifs ?? []).map((n) => (n as { id: string }).id);
      if (!notificationIds.length) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0, expired: 0, skipped: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    let pendingQuery = admin
      .from("notification_deliveries")
      .select("id, notification_id, user_id, device_id, attempts, status")
      .in("status", ["failed", "queued"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(200);
    if (notificationIds) pendingQuery = pendingQuery.in("notification_id", notificationIds);

    const { data: pending, error } = await pendingQuery;
    if (error) throw error;


    let sent = 0, failed = 0, expired = 0, skipped = 0;

    for (const batch of chunk(pending ?? [], 50)) {
      await Promise.all(batch.map(async (row) => {
        const delivery = row as {
          id: string; notification_id: string; user_id: string;
          device_id: string | null; attempts: number;
        };
        if (!delivery.device_id) { skipped++; return; }

        const { data: device } = await admin
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth, failure_count, disabled_at")
          .eq("id", delivery.device_id)
          .is("disabled_at", null)
          .maybeSingle();
        if (!device) { skipped++; return; }

        const { data: notification } = await admin
          .from("notifications")
          .select("title, body, route")
          .eq("id", delivery.notification_id)
          .maybeSingle();
        if (!notification) { skipped++; return; }

        const send = await sendWebPush(device as PushDevice, {
          title: notification.title as string,
          body: notification.body as string,
          url: (notification.route as string) ?? "/dashboard",
          notification_id: delivery.notification_id,
        });

        const status = send.ok ? "sent" : classifyPushResponse(send.httpStatus);
        if (status === "sent") sent++;
        else if (status === "expired") expired++;
        else failed++;

        await admin.from("notification_deliveries").update({
          status,
          attempts: delivery.attempts + 1,
          http_status: send.httpStatus || null,
          last_error: send.error ?? null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        }).eq("id", delivery.id);

        if (status === "expired") {
          await admin.from("push_subscriptions")
            .update({ disabled_at: new Date().toISOString() })
            .eq("id", device.id);
        }
      }));
    }

    return new Response(
      JSON.stringify({ success: true, processed: pending?.length ?? 0, sent, failed, expired, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("process-push-queue error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String((error as Error)?.message ?? error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
