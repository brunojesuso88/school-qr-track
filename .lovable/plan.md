## Diagnóstico

Auditei o fluxo do botão "Compartilhar link" (Projetos/Eventos e Eventos Escolares):

1. `EventCard.tsx` / `SchoolEventCard.tsx` copiam a URL `https://<projeto>.supabase.co/functions/v1/event-share?type=project|school&id=<uuid>`.
2. A edge function `event-share` responde 200 com `og:title`, `og:description`, `og:image` (signed URL de 7 dias) corretos — **as miniaturas funcionam**.
3. O HTML faz `window.location.replace` para `https://school-qr-track.lovable.app/events?id=<uuid>` (ou `/school-events?id=<uuid>`).

**Aqui começa o erro:** `/events` e `/school-events` são rotas protegidas por `AdminRoute`. Quando o destinatário do link:

- **Não está logado** → `AdminRoute` faz `<Navigate to="/auth" replace />` sem preservar a URL. O `?id=<uuid>` é descartado.
- **Faz login em seguida** → `Auth.tsx` (linhas 50-52) sempre navega para `/home` ou `/dashboard`, ignorando o destino original. O usuário cai numa página completamente diferente.
- **Já está logado** mas no domínio personalizado (`edunexusbruno.tech`) → o link força ir para `school-qr-track.lovable.app`, onde a sessão não existe (cookies/localStorage são separados por origem), e cai no `/auth` novamente, perdendo o id.

Resumo: a miniatura funciona; o redirecionamento "perde" o `id` e a rota original em todos os cenários comuns de quem recebe o link.

## Solução

Três correções pequenas e definitivas:

### 1. `AdminRoute.tsx` — preservar destino antes do login
- Importar `useLocation`.
- No `<Navigate to="/auth" replace />`, passar `state={{ from: location }}` para que o destino original (`pathname + search`) sobreviva à navegação.

### 2. `Auth.tsx` — voltar para o destino após login
- Importar `useLocation`.
- No `useEffect` que faz `navigate('/home' | '/dashboard')`, ler `location.state?.from` e, se existir um `pathname` válido (e o usuário tiver papel para acessá-lo), navegar para `from.pathname + from.search` em vez do default.
- Fallback continua sendo `/home` ou `/dashboard`.

### 3. `event-share/index.ts` — respeitar o domínio que o usuário publicou
- Em vez de fixar `PROJECT_BASE = 'https://school-qr-track.lovable.app'`, ler um override de `Deno.env.get('APP_BASE_URL')` (com fallback para `https://school-qr-track.lovable.app`).
- Definir o secret `APP_BASE_URL = https://edunexusbruno.tech` para que os redirecionamentos usem o domínio personalizado, onde o usuário já tem sessão ativa.
- Corrigir também o `canonical`/`og:url` no HTML para usar `https://<projeto>.supabase.co/functions/v1/event-share?...` (`x-forwarded-proto` + `x-forwarded-host`) em vez de `http://...` (hoje aparece "http" no canonical, o que prejudica o preview em algumas plataformas).

### Por que essa combinação resolve definitivamente

- A miniatura continua vindo da edge function (necessária para crawlers de WhatsApp/Facebook/LinkedIn que não executam JS).
- O usuário cai no domínio onde já tem sessão, então `AdminRoute` libera direto e o `?id=<uuid>` abre o modal do evento/projeto correto.
- Se ainda não estiver logado, o destino é preservado e ele é levado direto ao item após o login — sem cair em `/home` por engano.

## Detalhes técnicos

- Arquivos alterados:
  - `src/components/AdminRoute.tsx` (≈3 linhas)
  - `src/pages/Auth.tsx` (≈6 linhas no efeito de redirecionamento)
  - `supabase/functions/event-share/index.ts` (PROJECT_BASE via env + canonical com https)
- Novo secret de edge function: `APP_BASE_URL` (será solicitado com `add_secret`).
- Sem mudanças de schema, RLS, ou storage. Sem impacto em links já compartilhados — eles passarão a redirecionar corretamente assim que a função for re-deploy.
- O cache de preview do WhatsApp/Facebook permanece — capas alteradas só atualizam quando a plataforma re-faz o scrape.
