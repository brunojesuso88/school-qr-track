## Assinaturas da Gestão — Notificação Docente

### Objetivo
Permitir que Admin e Direção façam upload de imagens de assinatura (com nome do gestor), salvem para reutilização, marquem uma como padrão e a apliquem na notificação impressa — acima da linha "Direção Escolar".

### Backend (Lovable Cloud)

1. **Bucket privado** `management-signatures` (uploads em PNG/JPG, ≤ 1 MB).
2. **Tabela** `management_signatures`:
   - `id`, `name` (texto, ex: "Profa. Maria Silva — Diretora"), `role_label` (opcional, ex: "Diretora"), `storage_path`, `is_default` (bool), `created_by`, `created_at`.
   - RLS: SELECT/INSERT/UPDATE/DELETE liberado para `admin` e `direction` via `user_has_any_role`.
   - GRANTs para `authenticated` e `service_role`.
   - Trigger/constraint: ao marcar `is_default = true`, demais registros recebem `false` (única padrão global).
3. Políticas no `storage.objects` para o bucket: leitura/escrita restrita a Admin/Direção; arquivos servidos via signed URL.

### UI — `src/pages/TeacherNotifications.tsx`

1. Novo botão no topo da página: **"Assinaturas da gestão"** → abre dialog de gerenciamento.
2. **Dialog "Gerenciar assinaturas"**:
   - Lista as assinaturas salvas (preview da imagem + nome + badge "Padrão").
   - Ações por item: **Definir como padrão**, **Excluir**.
   - Formulário de upload: campo "Nome" (obrigatório), campo "Cargo/rótulo" (opcional, default "Direção Escolar"), input de arquivo (PNG/JPG, validação de tipo e tamanho), botão **Salvar**.
3. **Seleção por notificação** (padrão + troca):
   - Novo Select no painel da notificação: "Assinatura da gestão" — opção `Padrão (nome)` selecionada automaticamente, demais assinaturas listadas, mais opção **Sem assinatura**.
   - Persistir apenas em estado local (não altera tabela `teacher_notifications`).

### Renderização no documento impresso

Em `buildPrintHTML` (mesmo arquivo), no bloco `.signatures` lado "Direção Escolar":
- Se houver assinatura escolhida, renderizar `<img>` com altura ~52px centralizada **acima da linha**, seguida do nome do gestor logo abaixo do rótulo "Direção Escolar".
- Buscar a imagem como signed URL e embutir como `data:` base64 no HTML (evita CORS no `window.print`).
- Sem assinatura selecionada: mantém layout atual.
- Ajuste leve do espaçamento para não quebrar o "fit em 1 página" já existente.

### Detalhes técnicos
- Hook `useManagementSignatures()` com React Query: lista, cria (upload + insert), define padrão (update batch), exclui (delete row + remove do storage).
- Conversão para base64 via `fetch(signedUrl).then(r => r.blob()).then(FileReader)` antes de chamar `buildPrintHTML`.
- Validação client-side: tipo (`image/png`, `image/jpeg`), tamanho ≤ 1 MB, nome ≤ 80 chars.
- Sem alterações em outras telas/funcionalidades.

### Arquivos
- Nova migration: tabela + RLS + GRANTs + trigger de "única padrão".
- Novo bucket via `storage_create_bucket` + migration de policies.
- `src/pages/TeacherNotifications.tsx` — UI, seletor, integração no print.
- Novo `src/components/notifications/ManagementSignaturesDialog.tsx`.
- Novo `src/hooks/useManagementSignatures.ts`.
