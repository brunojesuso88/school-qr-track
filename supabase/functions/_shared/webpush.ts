import webpush from "npm:web-push@3.6.7";

export interface PushDevice {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number;
  disabled_at?: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  notification_id?: string | null;
  icon?: string;
  badge?: string;
  tag?: string;
}

export interface PushSendResult {
  ok: boolean;
  httpStatus: number;
  error?: string;
}

let configured = false;

/** Configura as chaves VAPID (nunca expostas ao cliente). */
export function configureWebPush(): boolean {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    const subject = Deno.env.get("VAPID_SUBJECT") ??
      "mailto:admin@edunexusbruno.tech";
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/**
 * Envio Web Push criptografado (aes128gcm) usando a biblioteca web-push.
 * Nunca lança: sempre retorna status para registro em notification_deliveries.
 */
export async function sendWebPush(
  device: PushDevice,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!configureWebPush()) {
    return { ok: false, httpStatus: 0, error: "VAPID keys not configured" };
  }

  try {
    const res = await webpush.sendNotification(
      {
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        notification_id: payload.notification_id ?? null,
        icon: payload.icon ?? "/pwa-192x192.png",
        badge: payload.badge ?? "/pwa-192x192.png",
        tag: payload.tag ?? "edunexus-notification",
      }),
      { TTL: 86400, urgency: "high" },
    );
    return { ok: true, httpStatus: res?.statusCode ?? 201 };
  } catch (error) {
    const err = error as { statusCode?: number; body?: string; message?: string };
    const httpStatus = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return {
      ok: false,
      httpStatus,
      error: (err?.body || err?.message || "unknown push error").slice(0, 500),
    };
  }
}

export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function classifyPushResponse(
  httpStatus: number,
): "sent" | "expired" | "failed" {
  if (httpStatus >= 200 && httpStatus < 300) return "sent";
  if (httpStatus === 404 || httpStatus === 410) return "expired";
  return "failed";
}
