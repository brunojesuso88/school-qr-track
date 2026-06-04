## Objetivo

Na impressão da Notificação Docente:
1. Remover as informações inseridas pelo navegador (data, horário, nome do documento, URL, número de páginas).
2. Garantir que o documento caiba sempre em **1 página A4**.

## Arquivo afetado

`src/pages/TeacherNotifications.tsx` — função `buildPrintHTML` (CSS de impressão + título da janela).

## Mudanças

### 1. Remover cabeçalho/rodapé do navegador

O cabeçalho/rodapé do navegador na impressão é controlado por `@page { margin }`. Quando a margem da `@page` é `0`, o Chrome/Edge/Brave omitem automaticamente data, URL, título e numeração.

- Trocar:
  ```css
  @page { size: A4 portrait; margin: 20mm 18mm; }
  ```
  por:
  ```css
  @page { size: A4 portrait; margin: 0; }
  body { padding: 14mm 16mm; }
  ```
  (margens visuais agora vêm do `body`, não da `@page`, então o navegador não desenha cabeçalho/rodapé).

- Definir `<title>` como string vazia/curta (ex.: `" "`) para que, mesmo se o usuário ativar manualmente "Cabeçalhos e rodapés" no diálogo de impressão, não apareça o nome do arquivo. A função `buildPrintHTML` passará a usar `<title> </title>` em vez de `${fileTitle}`.

### 2. Caber em 1 página A4

Reduzir levemente tamanhos/espaçamentos e impedir quebras:

- `body { font-size: 11pt; line-height: 1.45; }` (era 12pt / 1.55)
- `.header img { width: 95px; height: 95px; }` (era 115)
- `.header .info .school { font-size: 11pt; }`
- `.divider { margin: 8px 0 14px; }`
- `.title { margin-bottom: 12px; }` · `.title .t1 { font-size: 13pt; }` · `.title .t2 { font-size: 9.5pt; }` · `.title .meta { margin-top: 6px; font-size: 10.5pt; }`
- `.section { margin-bottom: 10px; }`
- `ul { padding-left: 20px; }` e `ul li { margin-bottom: 2px; }`
- `.signatures { margin-top: 32px; gap: 24px; page-break-inside: avoid; }` (era 56px)
- `.footer { margin-top: 18px; padding-top: 6px; font-size: 9pt; }`
- Adicionar wrapper `<div class="sheet">…</div>` com:
  ```css
  .sheet { page-break-inside: avoid; break-inside: avoid; }
  html, body { height: auto; }
  @media print {
    .sheet { transform-origin: top left; }
  }
  ```
- Como garantia extra contra estouro, injetar um pequeno script no `window.onload` (logo antes de `window.print()`) que mede `document.body.scrollHeight` vs altura útil de uma A4 (~1050px a 96dpi com as margens definidas); se exceder, aplica `document.querySelector('.sheet').style.transform = 'scale(' + ratio + ')'` para encolher proporcionalmente. Isso só age quando o conteúdo é grande o suficiente para passar de 1 página (ex.: motivo/justificativa longos).

## O que NÃO muda

- Layout/estilo da pré-visualização na tela (`NotificationPreview.tsx`) permanece igual.
- Conteúdo do documento (corpo, assinaturas, campos) — apenas tipografia/espaçamento na impressão.
- Banco de dados, fluxo de salvar/editar/excluir, histórico, filtros.

## Observação importante

A remoção de cabeçalho/rodapé do navegador depende da configuração `margin: 0` na regra `@page`, que é respeitada pelos navegadores baseados em Chromium (Chrome, Edge, Brave, Opera). No Firefox e Safari o usuário ainda pode precisar desmarcar manualmente "Cabeçalhos e rodapés" no diálogo de impressão — não há API web para forçar isso.
