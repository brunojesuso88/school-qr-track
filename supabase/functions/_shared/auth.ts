import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AppRole = "admin" | "direction" | "teacher" | "staff";

export interface AuthResult {
  userId: string;
  role: AppRole | null;
  userClient: ReturnType<typeof createClient>;
}

/**
 * Verify the Authorization header on an edge-function request and
 * optionally enforce that the caller has one of the allowed roles.
 *
 * Returns either a populated AuthResult or a Response (401/403) that the
 * caller should return directly.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  allowedRoles?: AppRole[],
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let role: AppRole | null = null;
  if (allowedRoles && allowedRoles.length > 0) {
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    role = (roleRow?.role as AppRole | undefined) ?? null;
    if (!role || !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  return { userId: userData.user.id, role, userClient };
}