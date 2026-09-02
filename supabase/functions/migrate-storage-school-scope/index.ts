import { requireAuth } from "../_shared/auth.ts";
import { isGlobalAdmin, serviceClient } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Migração ONE-SHOT e IDEMPOTENTE dos arquivos legados de Storage para o
 * padrão multi-escola `schools/<school_id>/<caminho legado>`.
 *
 * Só roda quando existe UMA escola (estado atual do sistema): todos os arquivos
 * legados pertencem a ela. Para cada objeto: copia -> atualiza referências no
 * banco -> remove o original apenas após sucesso da cópia.
 */
const BUCKETS = [
  "student-photos",
  "class-photos",
  "school-events",
  "medical-certificates",
  "aee-documents",
  "management-signatures",
] as const;

type Client = ReturnType<typeof serviceClient>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Lista recursivamente todos os caminhos de um bucket. */
async function listAll(admin: Client, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const items = data ?? [];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Pastas não têm metadata/id de objeto.
      if (item.id === null) out.push(...await listAll(admin, bucket, path));
      else out.push(path);
    }
    if (items.length < 100) break;
    offset += items.length;
  }
  return out;
}

/** Atualiza todas as referências guardadas no banco para o novo caminho. */
async function updateReferences(
  admin: Client,
  bucket: string,
  from: string,
  to: string,
): Promise<void> {
  const set = async (table: string, column: string) => {
    await admin.from(table).update({ [column]: to }).eq(column, from);
  };

  if (bucket === "student-photos") await set("students", "photo_url");
  if (bucket === "class-photos") await set("classes", "photo_url");
  if (bucket === "aee-documents") await set("students", "aee_laudo_attachment_url");
  if (bucket === "medical-certificates") await set("student_medical_certificates", "attachment_path");
  if (bucket === "management-signatures") await set("management_signatures", "storage_path");

  if (bucket === "school-events") {
    for (const table of ["school_events", "school_event_simple"]) {
      await set(table, "cover_image");
      const { data } = await admin.from(table).select("id, images");
      for (const row of (data ?? []) as { id: string; images: unknown }[]) {
        const arr = Array.isArray(row.images) ? row.images as string[] : [];
        if (!arr.includes(from)) continue;
        await admin.from(table)
          .update({ images: arr.map((v) => (v === from ? to : v)) })
          .eq("id", row.id);
      }
    }
    // Branding (logo/hero) fica guardado em settings como jsonb string.
    const { data: settings } = await admin
      .from("settings")
      .select("id, key, value")
      .in("key", ["school_logo_path", "school_hero_path"]);
    for (const row of (settings ?? []) as { id: string; value: unknown }[]) {
      const raw = typeof row.value === "string" ? row.value.replace(/^"|"$/g, "") : "";
      if (raw !== from) continue;
      await admin.from("settings").update({ value: to }).eq("id", row.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const admin = serviceClient();
    if (!await isGlobalAdmin(admin, auth.userId)) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    const { data: schools, error: schoolErr } = await admin.from("schools").select("id");
    if (schoolErr) throw schoolErr;
    if ((schools ?? []).length !== 1) {
      return json({
        success: false,
        error: "Migração automática só é segura com uma única escola cadastrada.",
      }, 409);
    }
    const schoolId = (schools as { id: string }[])[0].id;

    const report: Record<string, { migrated: number; skipped: number; failed: string[] }> = {};

    for (const bucket of BUCKETS) {
      const entry = { migrated: 0, skipped: 0, failed: [] as string[] };
      const names = await listAll(admin, bucket);
      for (const name of names) {
        if (name.startsWith("schools/")) {
          entry.skipped++;
          continue;
        }
        const target = `schools/${schoolId}/${name}`;
        const { error: copyErr } = await admin.storage.from(bucket).copy(name, target);
        if (copyErr && !String(copyErr.message).toLowerCase().includes("exists")) {
          entry.failed.push(name);
          continue;
        }
        // Confirma que o destino existe fisicamente antes de mexer nas referências.
        const { data: check } = await admin.storage.from(bucket).download(target);
        if (!check) {
          entry.failed.push(name);
          continue;
        }
        await updateReferences(admin, bucket, name, target);
        const { error: rmErr } = await admin.storage.from(bucket).remove([name]);
        if (rmErr) entry.failed.push(name);
        else entry.migrated++;
      }
      report[bucket] = entry;
    }

    return json({ success: true, school_id: schoolId, report });
  } catch (error) {
    console.error("migrate-storage-school-scope error:", error);
    return json({ success: false, error: String((error as Error)?.message ?? error) }, 500);
  }
});
