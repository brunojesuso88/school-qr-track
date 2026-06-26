## Diagnóstico

A captura mostra o navegador do WhatsApp renderizando o **código-fonte HTML** da edge function `event-share` como texto puro, em vez de executar o redirecionamento. Causas combinadas:

1. **Sem redirect HTTP real.** A função retorna `200 OK` com HTML que tenta redirecionar via `<meta http-equiv="refresh">` + `window.location.replace(...)`. O navegador in-app do WhatsApp (principalmente no iOS) frequentemente bloqueia/ignora ambos — quando isso acontece o usuário fica preso na página intermediária. Em alguns dispositivos a heurística do WhatsApp até trata o conteúdo como texto e exibe o HTML cru.
2. **Mesma URL serve crawler e humano.** O bot do WhatsApp precisa do HTML com `og:*`, mas o ser humano precisa de redirect imediato. Hoje os dois recebem a mesma resposta, e o humano depende de JS/meta-refresh que o WhatsApp pode ignorar.
3. **Sem fallback visível enquanto redireciona.** Mesmo quando o JS funciona, há um flash do HTML antes do replace.

## Solução

Servir respostas diferentes baseadas no `User-Agent`, mantendo as miniaturas funcionando para crawlers e dando redirect HTTP nativo para humanos.

### Alterações em `supabase/functions/event-share/index.ts`

1. **Detectar crawler de preview** pelo `User-Agent`:
   - Bots conhecidos (regex): `facebookexternalhit`, `Facebot`, `WhatsApp`, `Twitterbot`, `LinkedInBot`, `Slackbot`, `TelegramBot`, `Discordbot`, `SkypeUriPreview`, `Googlebot`, `bingbot`, `Applebot`, `embedly`, `redditbot`.
2. **Se for crawler** → retornar o HTML atual com as meta tags `og:*` (sem `meta refresh` nem `<script>` — só metadata + link). Isso garante a miniatura.
3. **Se for humano** → retornar **HTTP 302** com header `Location: <APP_BASE>/<rota>?id=<uuid>`. Redirect nativo do servidor é universal — funciona em qualquer navegador, inclusive no in-app do WhatsApp/iOS, e não há flash de HTML.
4. **Fallback** (sem User-Agent ou erro) → manter o HTML com `<meta refresh>` + link clicável, como rede de segurança.
5. **Endurecer Content-Type**: garantir `Content-Type: text/html; charset=utf-8` e adicionar `X-Content-Type-Options: nosniff` apenas na resposta HTML (no 302 não precisa de body).

### Por que isso resolve

- Crawlers continuam vendo `og:title`, `og:description`, `og:image` → miniatura preservada.
- Humanos recebem redirect HTTP nativo → o navegador do WhatsApp navega direto para `https://edunexusbruno.tech/events?id=...` ou `/school-events?id=...` sem nunca renderizar a página intermediária.
- Combinado com as correções já feitas em `AdminRoute` e `Auth`, o `?id=<uuid>` é preservado mesmo se for necessário logar.

### Detalhes técnicos

- Arquivo alterado: `supabase/functions/event-share/index.ts` (~30 linhas adicionadas).
- Sem mudanças de schema, RLS, secrets, frontend ou storage.
- Re-deploy da função aplica para todos os links já compartilhados.
- Cache do WhatsApp/Facebook continua igual — previews antigos só atualizam quando a plataforma re-faz o scrape (pode-se forçar via [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)).
