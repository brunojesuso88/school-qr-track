## Resumo
Trocar o nome e cargo na assinatura dos documentos de Notificação Docente de "Bruno de Jesus Oliveira — Coordenador Pedagógico" para "Direção Escolar".

## Escopo
- `src/components/notifications/NotificationPreview.tsx` — preview visual do documento
- `src/pages/TeacherNotifications.tsx` — versão para impressão (`buildPrintHTML`)

## Mudança técnica
Em ambos os arquivos, na seção de assinaturas:
- Substituir `<strong>Bruno de Jesus Oliveira</strong>` por `<strong>Direção Escolar</strong>`
- Substituir o texto "Coordenador Pedagógico" por "Direção Escolar"

Nenhuma outra alteração é necessária.