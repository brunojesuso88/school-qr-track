## Ajustes Notificação Docente

1. **Localização dos documentos**
   - Substituir "São Luís/MA" por "Coelho Neto/MA" no cabeçalho de data/place dos documentos.
   - Arquivos: `src/components/notifications/NotificationPreview.tsx` (preview em tela) e `src/pages/TeacherNotifications.tsx` (HTML de impressão/PDF).

2. **Seleção múltipla de obrigações**
   - O formulário já utiliza checkboxes com array (`obligations[]`), portanto a seleção múltipla já funciona tecnicamente.
   - Ajustar o label do campo de "Obrigação acadêmica não cumprida" (singular) para **"Obrigações acadêmicas não cumpridas"** (plural).
   - Adicionar hint abaixo do label: "Selecione uma ou mais opções".
   - Arquivo: `src/pages/TeacherNotifications.tsx`.