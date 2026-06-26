import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_APP_BASE = 'https://school-qr-track.lovable.app';
const APP_BASE = (Deno.env.get('APP_BASE_URL') || DEFAULT_APP_BASE).replace(/\/+$/, '');

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const truncate = (s: string, n = 160) => {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
};

const renderHtml = (opts: {
  title: string;
  description: string;
  image?: string | null;
  shareUrl: string;
  appUrl: string;
}) => {
  const t = escapeHtml(opts.title);
  const d = escapeHtml(opts.description);
  const u = escapeHtml(opts.shareUrl);
  const app = escapeHtml(opts.appUrl);
  const img = opts.image ? escapeHtml(opts.image) : '';
  const ogImage = img
    ? `\n    <meta property="og:image" content="${img}" />\n    <meta property="og:image:secure_url" content="${img}" />\n    <meta name="twitter:image" content="${img}" />`
    : '';
  const twitterCard = img ? 'summary_large_image' : 'summary';
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />${ogImage}
    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta http-equiv="refresh" content="0; url=${app}" />
    <script>window.location.replace(${JSON.stringify(opts.appUrl)});</script>
  </head>
  <body style="font-family:system-ui;padding:24px;color:#111">
    <h1>${t}</h1>
    <p>${d}</p>
    <p><a href="${app}">Abrir conteúdo</a></p>
  </body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get('type') || '').toLowerCase();
  const id = url.searchParams.get('id') || '';
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto') || 'https';
  const shareSelfUrl = fwdHost
    ? `${fwdProto}://${fwdHost}${url.pathname}${url.search}`
    : url.toString().replace(/^http:\/\//, 'https://');
  const fallback = (path: string, title = 'Sistema de Gestão', desc = 'Conteúdo da escola') =>
    new Response(
      renderHtml({
        title,
        description: desc,
        image: null,
        shareUrl: shareSelfUrl,
        appUrl: `${APP_BASE}${path}`,
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } },
    );

  if (!uuidRe.test(id) || (type !== 'project' && type !== 'school')) {
    return fallback('/');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let title = '';
  let description = '';
  let coverPath: string | null = null;
  let appPath = '/';

  if (type === 'project') {
    const { data } = await supabase
      .from('school_events')
      .select('title, resumo_ia, enfoque, cover_image, images')
      .eq('id', id)
      .maybeSingle();
    if (!data) return fallback('/events');
    title = data.title || 'Projeto escolar';
    description = data.resumo_ia || data.enfoque || 'Projeto da escola';
    coverPath = data.cover_image || (Array.isArray(data.images) ? data.images[0] as string : null);
    appPath = `/events?id=${id}`;
  } else {
    const { data } = await supabase
      .from('school_event_simple')
      .select('name, description, cover_image, images')
      .eq('id', id)
      .maybeSingle();
    if (!data) return fallback('/school-events');
    title = data.name || 'Evento escolar';
    description = data.description || 'Evento da escola';
    coverPath = data.cover_image || (Array.isArray(data.images) ? data.images[0] as string : null);
    appPath = `/school-events?id=${id}`;
  }

  let imageUrl: string | null = null;
  if (coverPath) {
    const { data: signed } = await supabase
      .storage
      .from('school-events')
      .createSignedUrl(coverPath, 60 * 60 * 24 * 7);
    imageUrl = signed?.signedUrl ?? null;
  }

  const html = renderHtml({
    title: truncate(title, 90),
    description: truncate(description, 200),
    image: imageUrl,
    shareUrl: shareSelfUrl,
    appUrl: `${APP_BASE}${appPath}`,
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
});