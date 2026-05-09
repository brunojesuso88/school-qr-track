## Mudanças solicitadas

### 1. Renomear "Eventos e Atas" → "Projetos"
- `src/components/DashboardLayout.tsx`: trocar label do item de menu para "Projetos" (ícone mantido).
- `src/pages/Events.tsx`: título da página passa a ser "Projetos", subtítulo ajustado para "Registro inteligente de projetos e ações do plano escolar".
- Buscas/placeholders e textos vazios ("Nenhum evento encontrado" → "Nenhum projeto encontrado", "Criar primeiro evento" → "Criar primeiro projeto", confirmação de exclusão).
- Não renomeio rota (`/events`), tabela (`school_events`) nem componentes internos — apenas a UI visível, para evitar quebra de URLs salvas e migrações desnecessárias.

### 2. Botão "Novo Evento" → "Novo Projeto"
- Botão primário no header de `Events.tsx` e botão do estado vazio.
- Título do `EventFormDialog` ajustado de "Novo evento / Editar evento" para "Novo projeto / Editar projeto".

### 3. Capa do card (upload dedicado)
Abordagem escolhida: **campo `cover_image` separado da galeria** — mais simples para o usuário e independente das imagens internas do projeto.

- Migração: adicionar coluna `cover_image text` em `public.school_events` (nullable). Reaproveita o bucket privado `school-events` (mesmo padrão das imagens já existentes).
- `src/components/events/types.ts`: adicionar `cover_image?: string | null` ao tipo `SchoolEvent` e ao `normalizeEventFromAI`.
- `EventFormDialog.tsx` (aba "Mídia"): nova seção "Capa do projeto" no topo, com:
  - Preview circular/retangular da capa atual (signed URL).
  - Botão "Enviar capa" (input file, aceita imagens), upload para `school-events/covers/{uuid}.{ext}`.
  - Botão "Remover capa".
  - Salvar `cover_image` no `save()` junto com os outros campos.
- `EventCard.tsx`: a thumbnail lateral passa a usar `cover_image` quando existir; cai para `images[0]` como fallback (compatibilidade com projetos antigos). Tamanho atual (md:w-48 h-40) mantido.

### 4. PDF profissional com cabeçalho institucional
Função `onExport` em `src/pages/Events.tsx` recebe um cabeçalho fixo no topo de toda página:

```text
+--------------------------------------------------+
| [LOGO]   CENTRO DE ENSINO PROF. ANTÔNIO NONATO   |
|          SAMPAIO                                 |
|          Coelho Neto - MA                        |
|          ─────────────────────────────────────── |
+--------------------------------------------------+
|  PROJETO: <título>                               |
|  Status • Período                                |
|  ...                                             |
```

Implementação:
- Copiar a logo enviada para `src/assets/logo-cepans.png` e importá-la no `Events.tsx`.
- Converter a imagem para dataURL no carregamento do componente (via `fetch` + `FileReader`) para uso em `doc.addImage()` do jsPDF.
- Helper `drawHeader(doc)` chamado no início e em cada `addPage()`:
  - Logo no canto superior esquerdo (~60×60pt).
  - Nome da escola em negrito ao lado, segunda linha "Coelho Neto – MA".
  - Linha separadora horizontal abaixo.
  - Ajustar `y` inicial para abaixo do cabeçalho (~110pt).
- Rodapé simples com numeração "Página X" centralizada.
- Substituir wrap de paginação manual pelo controle via `drawHeader` em quebras automáticas.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — adicionar coluna `cover_image` em `school_events`.
- `src/components/DashboardLayout.tsx` — label do menu.
- `src/pages/Events.tsx` — textos, botões, PDF com cabeçalho/logo.
- `src/components/events/EventFormDialog.tsx` — upload de capa e título do dialog.
- `src/components/events/EventCard.tsx` — usar `cover_image` com fallback.
- `src/components/events/types.ts` — campo `cover_image`.
- `src/assets/logo-cepans.png` — logo institucional (do upload).

## Fora do escopo

- Renomear a rota `/events`, a tabela `school_events` ou as edge functions.
- Alterar lógica de IA, importação de PDF ou outros campos do projeto.
