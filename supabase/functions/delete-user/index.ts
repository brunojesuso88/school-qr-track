import { createClient } from 'npm:@supabase/supabase-js@2'

// CORS local: o runtime Deno não expõe `npm:@supabase/supabase-js@2/cors`.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing required backend environment variables')
      return json({ error: 'Backend configuration error' }, 500)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.getUser(token)
    const currentUserId = userData?.user?.id
    if (userError || !currentUserId) {
      console.error('Caller token validation failed:', userError?.message ?? 'user missing')
      return json({ error: 'Invalid or expired session' }, 401)
    }

    // Autorização crítica: somente ADMINISTRADOR GLOBAL exclui contas.
    const { data: isGlobalAdmin } = await userClient.rpc('is_global_admin')
    if (isGlobalAdmin !== true) {
      return json({ error: 'Apenas o administrador global pode excluir contas' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'userId inválido' }, 400)
    }
    if (userId === currentUserId) {
      return json({ error: 'Não é possível excluir a própria conta' }, 400)
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Error deleting user:', deleteError.message)
      return json({ error: 'Falha ao excluir usuário', details: deleteError.message }, 500)
    }

    return json({ success: true, message: 'Usuário excluído com sucesso' })
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
