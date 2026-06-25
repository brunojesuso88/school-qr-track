## Objetivo

Adicionar um novo campo de texto livre chamado **"Orientação da Gestão escolar"** no formulário de Notificação Docente. O conteúdo será salvo junto à notificação, aparecerá no preview e no documento impresso/PDF.

## Onde aparece

- **Formulário** (aba "Nova Notificação"): novo `Textarea` posicionado logo após o campo "Justificativa do Docente", como última seção editável antes dos botões.
- **Preview** na tela: bloco com título "Orientação da Gestão Escolar" exibido depois da Justificativa do Docente, antes das assinaturas. Só aparece quando preenchido.
- **Documento impresso / PDF**: mesma posição, mesma regra (oculto se vazio). Tipografia idêntica às outras seções para manter o ajuste de 1 página.
- **Edição** de notificações já salvas: o valor é carregado normalmente ao clicar em "Editar" no histórico.

## Mudanças técnicas

1. **Banco de dados** — migration adicionando coluna `management_guidance TEXT NULL` em `teacher_notifications` (sem alterar RLS existente).
2. **`src/lib/notificationTemplates.ts`** — adicionar `management_guidance?: string | null` em `NotificationData`.
3. **`src/pages/TeacherNotifications.tsx`**:
   - Incluir `management_guidance: ''` em `emptyForm`.
   - Adicionar `Textarea` no formulário rotulado "Orientação da Gestão escolar".
   - Persistir o campo nos handlers de criar/atualizar (linhas ~316 e ~337) e ler nos handlers de carregar/editar (linhas ~388 e ~420).
   - Adicionar bloco condicional no HTML de impressão (`buildPrintHTML`, ~linha 168) seguindo o mesmo padrão de `teacher_justification`.
4. **`src/components/notifications/NotificationPreview.tsx`** — renderizar bloco condicional com o mesmo padrão usado para `teacher_justification`.

## Fora de escopo

- Não altera regras de assinaturas, layout das assinaturas, nem o ajuste automático de 1 página.
- Não modifica políticas de RLS nem fluxo de impressão (apenas adiciona uma seção opcional).
