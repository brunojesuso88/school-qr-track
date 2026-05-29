## Problema
Na aba Sistema AEE, ao editar PEI ou PAEE, clicar fora do Dialog (overlay) fecha a janela e descarta os dados preenchidos.

## Causa
O `DialogContent` do Radix UI possui comportamento padrão que fecha o Dialog ao interagir fora dele (`onInteractOutside`). O Dialog principal do AEE (`isDialogOpen`) não está protegido contra esse evento.

## Solução
Adicionar `onInteractOutside={(e) => e.preventDefault()}` no `DialogContent` principal do AEE (`src/pages/AEE.tsx`, linha ~1571). Isso impede que cliques no overlay fechem o Dialog, exigindo que o usuário clique no botão "Cancelar" ou no X para sair.

Opcionalmente, também adicionar `onEscapeKeyDown={(e) => e.preventDefault()}` para impedir que a tecla ESC feche o Dialog e perca os dados.

## Escopo
- Apenas `src/pages/AEE.tsx` — o Dialog principal de edição/visualização do aluno.
- O Photo Zoom Dialog (linha ~2099) pode continuar fechando ao clicar fora, pois não envolve edição de dados.

## Implementação
Alterar a tag `<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">` para incluir os handlers acima.