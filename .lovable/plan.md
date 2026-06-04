## Problema
Nas assinaturas do documento "Notificação Docente", o texto "Direção Escolar" aparece duplicado: uma vez como nome (<strong>) e outra como cargo/role abaixo. Isso ocorreu porque a substituição anterior converteu "Bruno de Jesus Oliveira / Coordenador Pedagógico" para "Direção Escolar / Direção Escolar".

## Arquivos afetados
1. `src/pages/TeacherNotifications.tsx` — função `buildPrintHTML` (linha ~287)
2. `src/components/notifications/NotificationPreview.tsx` — bloco de assinaturas (linhas ~111–113)

## Solução
Em ambos os arquivos, remover a linha de cargo/role que repete "Direção Escolar", mantendo apenas o nome em negrito. A assinatura ficará assim:

```
─────────────────────
Direção Escolar
```

Sem duplicação. O professor mantém o formato normal.