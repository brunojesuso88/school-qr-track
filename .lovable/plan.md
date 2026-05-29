## Ajustes no cabeçalho da Notificação Docente

### Objetivo
Ajustar a formatação do texto no cabeçalho dos documentos de notificação para que o conteúdo caiba em uma única linha.

### Alterações

**1. Reduzir a margem direita (spacer)**
- `src/components/notifications/NotificationPreview.tsx`: reduzir o `div` espaçador à direita de `110px` para `40px`, ampliando o espaço disponível para o texto central.
- `src/pages/TeacherNotifications.tsx`: aplicar o mesmo ajuste no HTML de impressão, reduzindo o espaçador de `115px` para `40px`.

**2. Ajustar a formatação do texto "SEDUC MA"**
- Diminuir ligeiramente o `fontSize` de `12px` para `11px`.
- Reduzir o `letterSpacing` de `1px` para `0.5px`.
- Esses ajustes combinados com a margem maior garantem que "SECRETARIA DE ESTADO DA EDUCAÇÃO DO MARANHÃO (SEDUC MA)" fique em uma única linha tanto na pré-visualização quanto na impressão.

### Arquivos
- `src/components/notifications/NotificationPreview.tsx`
- `src/pages/TeacherNotifications.tsx`