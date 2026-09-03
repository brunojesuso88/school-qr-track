import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = [
  "student-photos",
  "school-events",
  "class-photos",
  "medical-certificates",
  "aee-documents",
  "management-signatures",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Remove recursivamente todos os objetos sob schools/<school_id>/ do bucket. */
async function purgePrefix(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<number> {
  let removed = 0;
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return removed;

  const files = data.filter((e) => e.id).map((e) => `${prefix}/${e.name}`);
  if (files.length > 0) {
    const { error: delError } = await admin.storage.from(bucket).remove(files);
    if (!delError) removed += files.length;
  }
  for (const folder of data.filter((e) => !e.id)) {
    removed += await purgePrefix(admin, bucket, `${prefix}/${folder.name}`);
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    // Autorização crítica no backend: somente administrador GLOBAL.
    const { data: isGlobalAdmin } = await userClient.rpc("is_global_admin");
    if (isGlobalAdmin !== true) {
      return json({ error: "Apenas o administrador global pode excluir escolas" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
      return json({ error: "schoolId inválido" }, 400);
    }

    // Exclusão dos dados (auditada, cascata por school_id) — feita pela RPC.
    const { data: result, error: rpcError } = await userClient.rpc("admin_delete_school", {
      _school_id: schoolId,
    });
    if (rpcError) return json({ error: rpcError.message }, 400);

    // Limpeza dos arquivos escolares após a exclusão dos registros.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let filesRemoved = 0;
    for (const bucket of BUCKETS) {
      filesRemoved += await purgePrefix(admin, bucket, `schools/${schoolId}`);
    }

    return json({ success: true, result, filesRemoved });
  } catch (error) {
    console.error("delete-school error", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
