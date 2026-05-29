# Plano — Módulo Notificação Docente (CEPANS)

Nova aba institucional para emitir, visualizar, baixar em PDF e arquivar notificações administrativas a professores. Histórico persistido no banco; acesso restrito a Admin e Direção.

## 1. Banco de dados (migration)

Criar tabela `public.teacher_notifications`:

- `doc_number` (int) e `doc_year` (int) — numeração sequencial por ano (gerada via função `next_teacher_notification_number(year)` com lock para evitar duplicidade)
- `teacher_name` (text)
- `stage` (text: `stage_1` | `stage_2`)
- `reason` (text)
- `obligations` (text[]) + `other_obligation` (text, opcional)
- `original_deadline` (date), `new_deadline` (date)
- `classes_subjects` (text, opcional)
- `teacher_justification` (text, opcional)
- `custom_body` (text, opcional — corpo editado manualmente)
- `created_by` (uuid), `created_at`, `updated_at`

GRANTs para `authenticated` + `service_role`. RLS: SELECT/INSERT/UPDATE/DELETE restritos a `admin` e `direction` via `user_has_any_role`. Trigger de `updated_at`.

## 2. Rota e navegação

- Adicionar rota `/teacher-notifications` em `src/App.tsx` (envolta em `AdminRoute`).
- Adicionar item "Notificação Docente" em `allNavigation` (`src/components/DashboardLayout.tsx`) com ícone `FileWarning` e `roles: ['admin', 'direction']`.

## 3. Página `src/pages/TeacherNotifications.tsx`

Layout em duas abas (Tabs do shadcn):

**Aba "Nova Notificação"** — grid 2 colunas (responsivo, vira 1 coluna no mobile):

- **Coluna esquerda — Formulário** (Card "Dados da Notificação")
  - Nome do professor, Etapa (select com descrição), Motivo (textarea)
  - Obrigações (checkbox group com 11 opções; "Outros" abre input adicional)
  - Prazos original e novo (date pickers shadcn com `pointer-events-auto`)
  - Turmas/disciplina, Justificativa do professor
  - Numeração exibida como `0001/2026` (prévia — calculada via `MAX(doc_number)+1` para o ano corrente)
  - Botões: Gerar Documento (salva no banco), Visualizar Prévia (já é live, abre dialog ampliado), Baixar PDF, Imprimir, Limpar
- **Coluna direita — Prévia A4 em tempo real**
  - Componente `<NotificationPreview />` com aparência de folha A4, sombra, cabeçalho institucional + `logoCepans` (reaproveitado de `src/pages/AEE.tsx`)
  - Cabeçalho: ESTADO DO MARANHÃO / SECRETARIA DE ESTADO DA EDUCAÇÃO / CEPANS, linha divisória
  - Título dinâmico por etapa, número do documento, data
  - Corpo gerado por template (Etapa 1 ou 2) com placeholders substituídos
  - Lista de obrigações marcadas, bloco de justificativa (oculto se vazio)
  - Assinaturas: Bruno de Jesus Oliveira — Coordenador Pedagógico + Ciente do professor
  - Rodapé institucional
  - Permitir editar o corpo (toggle "Editar texto" → textarea sincronizada com `custom_body`)

**Aba "Histórico"**
- Tabela com filtros: professor (search), etapa (select), data (range), disciplina (search)
- Ações por linha: Visualizar, Reabrir/Editar, Baixar PDF, Excluir

## 4. PDF e impressão

- Reutilizar o padrão já usado em AEE/Declarations: abrir `window.open()` com HTML estilizado para A4, `@page { size: A4; margin: 20mm }`, `@media print`.
- "Baixar PDF" → `window.print()` na janela aberta (navegador → "Salvar como PDF"). Mantém consistência com o resto do projeto (sem nova dependência).
- "Imprimir" → mesmo fluxo, foco em impressora.
- Nome sugerido do arquivo via `document.title = 'NOTIFICACAO_<NOME>_<ANO>'`.

## 5. Identidade visual

- Paleta institucional aplicada via classes Tailwind utilitárias inline na prévia (azul `#0D47A1`, azul escuro `#0B2E59`, vermelho `#C62828`, cinza `#F5F7FA`) — somente dentro do HTML da prévia/impressão, mantendo o resto da UI fiel aos tokens semânticos do design system.
- Botões na UI da aba usam variantes shadcn (`default`, `secondary`, `destructive`, `outline`) — sem cores hardcoded em componentes.

## 6. Arquivos a criar/editar

**Criar**
- `supabase/migrations/<timestamp>_teacher_notifications.sql`
- `src/pages/TeacherNotifications.tsx`
- `src/components/notifications/NotificationPreview.tsx`
- `src/components/notifications/NotificationForm.tsx`
- `src/components/notifications/NotificationHistory.tsx`
- `src/lib/notificationTemplates.ts` (textos das Etapas 1 e 2 + lista de obrigações)

**Editar**
- `src/App.tsx` (rota)
- `src/components/DashboardLayout.tsx` (sidebar)

## 7. Fora do escopo

- Assinatura digital eletrônica
- Envio automático por e-mail/WhatsApp ao professor (pode ser próximo passo)
- Workflow de "ciente" online pelo professor
