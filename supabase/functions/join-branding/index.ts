import { createClient } from 'npm:@supabase/supabase-js@2'

// CORS local (o runtime não expõe subcaminho /cors do SDK).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const BUCKET = 'school-events'
const HERO_KEY = 'school_hero_path'
const LOGO_KEY = 'school_logo_path'

const unwrap = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/^"|"$/g, '') : value == null ? '' : String(value)

/**
 * Branding público de cadastro: recebe SOMENTE o token do link `/join/:token`.
 * O school_id e os caminhos das imagens são resolvidos no servidor — o cliente
 * nunca escolhe escola nem path. Retorna apenas nome + URLs assinadas curtas.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Backend configuration error' }, 500)

    const body = await req.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!token || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json({ valid: false }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: link } = await admin
      .from('school_registration_links')
      .select('school_id, active, revoked_at, expires_at, max_uses, use_count')
      .eq('token', token)
      .maybeSingle()

    if (!link || link.active !== true || link.revoked_at) return json({ valid: false })
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return json({ valid: false })
    }
    if (typeof link.max_uses === 'number' && link.use_count >= link.max_uses) {
      return json({ valid: false })
    }

    const { data: school } = await admin
      .from('schools')
      .select('name, status')
      .eq('id', link.school_id)
      .maybeSingle()
    if (!school || school.status !== 'active') return json({ valid: false })

    const { data: settingsRows } = await admin
      .from('settings')
      .select('key, value')
      .eq('school_id', link.school_id)
      .in('key', [HERO_KEY, LOGO_KEY])

    const byKey = new Map((settingsRows ?? []).map((r) => [r.key as string, unwrap(r.value)]))
    const signed = async (path: string) => {
      if (!path) return null
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 600)
      return data?.signedUrl ?? null
    }

    return json({
      valid: true,
      school_name: school.name,
      hero_url: await signed(byKey.get(HERO_KEY) ?? ''),
      logo_url: await signed(byKey.get(LOGO_KEY) ?? ''),
    })
  } catch (error) {
    console.error('join-branding error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
