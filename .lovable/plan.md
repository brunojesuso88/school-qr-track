## Ajustes: assinaturas no final + prévia com imagem

### 1. Assinaturas coladas no rodapé (impressão, 1 página)
Em `buildPrintHTML` (`src/pages/TeacherNotifications.tsx`):
- Tornar `.sheet` um flex column com altura mínima da área útil da A4 (`min-height: 269mm`).
- Agrupar o conteúdo superior (header, título, body, motivo, obrigações, turmas, justificativa) num wrapper `.content`.
- Aplicar `margin-top: auto` no bloco `.signatures` para empurrá-lo ao final.
- Reduzir o `margin-top: 64px` atual das assinaturas (não é mais necessário) e manter `page-break-inside: avoid`.
- Footer continua após as assinaturas, com espaçamento menor.
- Manter o `fitToOnePage()` como salvaguarda caso o conteúdo seja muito longo.

Resultado: assinaturas sempre no rodapé da página, independentemente do tamanho do conteúdo, em uma única página.

### 2. Mostrar assinatura selecionada na prévia
Atualmente `NotificationPreview` não recebe nem renderiza a imagem da assinatura.

Em `src/pages/TeacherNotifications.tsx`:
- Novo estado `previewSignature: SignatureForPrint | null`.
- `useEffect` reagindo a `[selectedSignatureId, signatures]` que chama `resolveSelectedSignature()` e atualiza `previewSignature` (com guard para evitar race condition).
- Passar `signature={previewSignature}` para `<NotificationPreview ... />` (tanto inline quanto no dialog de prévia ampliada).

Em `src/components/notifications/NotificationPreview.tsx`:
- Aceitar nova prop opcional `signature?: { dataUrl: string; name: string; role_label: string | null } | null`.
- No bloco de assinaturas, lado "Direção Escolar":
  - Se `signature` existir: renderizar `<img>` (altura ~52px, `object-fit: contain`) centralizado acima da linha; usar `signature.role_label || 'Direção Escolar'` como rótulo; mostrar `signature.name` em cinza abaixo do rótulo.
  - Sem assinatura: layout atual inalterado.
- Para refletir o "rodapé": aumentar o `marginTop` da grid de assinaturas (ex.: `marginTop: 96`) para aproximar visualmente a prévia do documento impresso.

### Arquivos alterados
- `src/pages/TeacherNotifications.tsx` — CSS do print + estado/efeito de prévia.
- `src/components/notifications/NotificationPreview.tsx` — nova prop e renderização da imagem.

Sem mudanças de backend, schema ou outras telas.
