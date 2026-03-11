

# Plano: Trocar Câmera + Moldura Circular

## Alterações em `src/components/CameraPhotoCapture.tsx`

### 1. Botão para trocar câmera (frontal/traseira)
- Adicionar estado `facingMode` (`'user'` | `'environment'`), default `'user'`
- Função `toggleCamera`: para a câmera atual, inverte `facingMode`, reinicia com `startCamera`
- Passar `facingMode` como parâmetro no `getUserMedia`
- Adicionar botão com ícone `SwitchCamera` (lucide) ao lado do botão Capturar, visível quando câmera está ativa
- Remover `transform: scaleX(-1)` quando `facingMode === 'environment'` (câmera traseira não deve espelhar)

### 2. Moldura circular
- Substituir a moldura retangular 3x4 por uma moldura circular usando `border-radius: 50%` e `boxShadow: 0 0 0 9999px` para o overlay escuro
- Remover os corner markers (não fazem sentido em moldura circular)
- Atualizar o texto guia para "Enquadre o rosto na moldura"
- Na captura (canvas), recortar em proporção 1:1 (quadrado) para alinhar com a moldura circular — output 400x400
- A imagem resultante será quadrada; a visualização circular fica por conta do CSS no avatar

### Resumo

| O quê | Como |
|-------|------|
| Trocar câmera | Estado `facingMode` + botão `SwitchCamera` |
| Moldura circular | `border-radius: 50%` + overlay + crop 1:1 no canvas |
| Espelhamento | `scaleX(-1)` só na câmera frontal |

Arquivo único alterado: `src/components/CameraPhotoCapture.tsx`

