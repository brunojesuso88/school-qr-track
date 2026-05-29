## Ajustes no cabeçalho da Notificação Docente

1. **Atualizar texto do cabeçalho**
   - Substituir "SECRETARIA DE ESTADO DA EDUCAÇÃO" por "SECRETARIA DE ESTADO DA EDUCAÇÃO DO MARANHÃO (SEDUC MA)" em ambas as etapas do documento.
   - Arquivos:
     - `src/components/notifications/NotificationPreview.tsx` (pré-visualização ao vivo)
     - `src/pages/TeacherNotifications.tsx` (HTML de impressão/PDF)

2. **Aumentar tamanho do logo CEPANS**
   - Aumentar de 84×84 px para 110×110 px no componente de pré-visualização (`NotificationPreview.tsx`).
   - Ajustar o espaçador simétrico do lado direito de 84 px para 110 px.
   - Aumentar de 90×90 px para 115×115 px no HTML de impressão (`TeacherNotifications.tsx`), incluindo o espaçador correspondente.