const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Valida formato/tamanho sem revelar o valor. */
function isValidPublicKey(key: string): boolean {
  const k = key.trim();
  if (k.length < 80 || k.length > 100) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(k)) return false;
  if (!k.startsWith("B")) return false;
  try {
    const padded = k + "=".repeat((4 - (k.length % 4)) % 4);
    const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return bin.length === 65;
  } catch {
    return false;
  }
}

/**
 * Expõe apenas a chave VAPID PÚBLICA (necessária no navegador para
 * pushManager.subscribe). A chave privada nunca sai do servidor.
 */
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const publicKey = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!publicKey) {
    return json({
      public_key: null,
      configured: false,
      error: "VAPID_PUBLIC_KEY não está configurada no servidor.",
    }, 500);
  }

  if (!isValidPublicKey(publicKey)) {
    // Nunca logar nem retornar o valor — apenas o diagnóstico de formato.
    return json({
      public_key: null,
      configured: false,
      error:
        "VAPID_PUBLIC_KEY inválida: esperado base64url de ~87 caracteres (chave P-256 de 65 bytes).",
    }, 500);
  }

  return json({ public_key: publicKey, configured: true });
});
