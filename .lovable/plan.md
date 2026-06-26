## Ajuste da capa no "Visualizar" de Eventos e Projetos

Hoje, ao abrir o modal de detalhes:
- **Eventos** (`SchoolEventDetailDialog.tsx`): a capa fica num container `aspect-video` com `object-cover` → corta topo/base de imagens verticais.
- **Projetos** (`EventDetailDialog.tsx`): nem exibe a capa no topo, só as fotos secundárias.

### Mudanças

**1. `src/components/school-events/SchoolEventDetailDialog.tsx`**
- Trocar `object-cover` por `object-contain` no `<img>` da capa.
- Manter o container com fundo `bg-muted` e altura máxima (ex.: `max-h-[60vh]`) em vez de `aspect-video` fixo, para que imagens em retrato ou paisagem apareçam inteiras, centralizadas, sem corte.

**2. `src/components/events/EventDetailDialog.tsx`** (Projetos)
- Adicionar bloco de capa no topo do modal (usando `event.cover_image` ou primeira de `event.images`), com o mesmo padrão: container `bg-muted`, `max-h-[60vh]`, imagem com `object-contain` centralizada.
- Carregar a signed URL da capa via `supabase.storage.from('school-events').createSignedUrl(...)` igual ao card.
- Aplicar `object-contain` também nas miniaturas da grade de fotos se necessário (opcional — manter `object-cover` na grade está ok, pois é só thumbnail).

Sem alterações em backend, dados ou cards.
