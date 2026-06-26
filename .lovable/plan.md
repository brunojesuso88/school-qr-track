
## Problema

Hoje o botão "Compartilhar link" em **Projetos e Eventos** (`EventCard`) e **Eventos Escolares** (`SchoolEventCard`) copia uma URL do tipo `/events?id=…` ou `/school-events?id=…`. Como o app é uma SPA (apenas `index.html` estático) e o bucket `school-events` é **privado**, os crawlers de WhatsApp/Facebook/LinkedIn/Slack nunca conseguem ler uma `og:image` específica do item — então a miniatura sai vazia ou genérica.

Para que cada link compartilhado mostre a capa do evento/projeto correspondente, precisamos de uma resposta HTML renderizada no servidor com as meta tags `og:*` corretas. SPA + cliente não resolve.

## Solução

Criar uma **edge function pública** `event-share` que devolve um HTML mínimo com as meta tags Open Graph/Twitter Card preenchidas a partir do registro do banco, e em seguida redireciona o usuário humano para a rota real da SPA.

O botão "Compartilhar link" passa a copiar a URL dessa edge function em vez da URL da SPA.

### Comportamento da edge function

Endpoint: `GET /functions/v1/event-share?type=project|school&id=<uuid>`

1. Busca o registro com **service role** (sem exigir login do crawler):
   - `type=project` → tabela `school_events` (usada por `EventCard` / página *Projetos e Eventos*).
   - `type=school`  → tabela `school_event_simple` (usada por `SchoolEventCard` / página *Eventos Escolares*).
2. Gera uma **signed URL** longa (7 dias) para `cover_image` (ou primeira imagem em `images[]`) no bucket privado `school-events`. Como a função é chamada a cada novo scrape, a URL sempre estará válida na hora.
3. Responde `text/html` com:
   - `<title>` = nome/título do item
   - `<meta name="description">` = resumo curto (descrição truncada em ~160 chars)
   - `<meta property="og:title|og:description|og:image|og:url|og:type>` 
   - `<meta name="twitter:card" content="summary_large_image">` + `twitter:title/description/image`
   - `<meta http-equiv="refresh" content="0; url=/events?id=…">` para redirecionar o navegador humano
   - Fallback `<script>location.replace(...)</script>` e um link clicável dentro do `<body>`
4. Headers de cache: `Cache-Control: public, max-age=300` para acelerar re-scrapes.
5. Se o item não tiver capa, omite `og:image` (preview sem miniatura é melhor do que miniatura quebrada).
6. Se o id for inválido ou não existir, devolve HTML simples com redirecionamento para a página de listagem.

### Mudanças na UI

- `src/components/events/EventCard.tsx`: `handleShare` passa a copiar
  `${origin}/functions/v1/event-share?type=project&id=${event.id}`.
- `src/components/school-events/SchoolEventCard.tsx`: idem com `type=school`.
- Mensagem do toast permanece a mesma ("Link copiado…").

### Detalhes técnicos

- A função roda com `verify_jwt = false` no `supabase/config.toml` (crawlers não enviam JWT) e usa `SUPABASE_SERVICE_ROLE_KEY` apenas internamente para ler o registro e gerar a signed URL.
- O retorno expõe somente título, descrição e capa — campos já considerados públicos em um link compartilhado pelo gestor. Nenhum dado sensível (alunos, ocorrências, etc.) entra no HTML.
- Sanitização básica do título/descrição (escape de `<`, `>`, `&`, `"`) para evitar injeção nas meta tags.
- URL da edge function montada via `import.meta.env.VITE_SUPABASE_URL` para apontar sempre ao ambiente correto.
- Aviso pós-implantação: previews em WhatsApp/Telegram ficam em cache nos servidores deles; alterar a capa pode levar horas para refletir até que cada plataforma faça um novo scrape.

### Fora de escopo

- Não estamos tornando o bucket público nem criando preview de imagens compostas (ex.: card com título por cima da capa). Apenas a capa original é usada.
- Não estamos adicionando rotas SSR ao app nem alterando o `index.html` sitewide.
