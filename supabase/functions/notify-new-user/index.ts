import { requireAuth } from "../_shared/auth.ts";
import { dispatchNotification, resolveAudience, serviceClient } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Avisa administradores sobre um novo cadastro.
 * Usa a infraestrutura unificada de notificações (central interna + Web Push
 * criptografado via web-push), em vez do JWT VAPID manual anterior.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // O disparo vem do próprio usuário recém-cadastrado (autenticado).
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const admin = serviceClient();

    // Nunca confiar na identidade enviada pelo cliente.
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", auth.userId)
      .maybeSingle();

    const label = (profile?.full_name as string | null) ||
      (profile?.email as string | null) || "Novo usuário";

    const userIds = await resolveAudience(admin, "new_user_signup");
    if (!userIds.length) {
      return new Response(JSON.stringify({ success: true, recipients: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await dispatchNotification({
      admin,
      eventType: "new_user_signup",
      entityId: auth.userId,
      entityType: "auth_user",
      createdBy: auth.userId,
      userIds,
      context: {
        body: `${label} criou uma conta e aguarda definição de permissões.`,
        route: "/settings",
      },
    });

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-new-user error:", error);
    // Nunca bloquear o cadastro por falha de notificação.
    return new Response(
      JSON.stringify({ success: false, error: String((error as Error)?.message ?? error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
