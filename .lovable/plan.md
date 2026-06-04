No CSS inline da função `buildPrintHTML` em `src/pages/TeacherNotifications.tsx`, ajustar os seguintes valores para aumentar o espaço vertical dedicado às assinaturas "Direção Escolar" e "Ciente do(a) professor(a)":

1. **`.signatures`** — aumentar `margin-top` de `32px` para `64px` (mais espaço entre o conteúdo do documento e as assinaturas).
2. **`.sig .line`** — aumentar `padding-top` de `6px` para `20px` (mais espaço entre a linha de assinatura e o rótulo, permitindo assinatura manuscrita confortável).

Nenhuma outra alteração necessária. O ajuste visa melhorar a legibilidade e o espaço físico para assinaturas no documento impresso.