

# Plano: Adicionar "Tirar Foto" com Câmera e Moldura 3x4

## Contexto Atual

Em `src/pages/Students.tsx` (linhas 578-618), o upload de foto do aluno só permite selecionar um arquivo do dispositivo via `<input type="file">`. Não há opção de capturar foto diretamente pela câmera.

## Solução

### 1. Criar componente `CameraPhotoCapture`

**Novo arquivo**: `src/components/CameraPhotoCapture.tsx`

- Um Dialog/modal que abre a câmera do dispositivo via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`
- Exibe o feed da câmera em um `<video>` element
- Sobrepõe uma **moldura 3x4** (proporção 3:4) centralizada com bordas arredondadas e cantos destacados, simulando o enquadramento de foto de documento
- A área fora da moldura fica semi-transparente (overlay escuro) para guiar o enquadramento
- Botões: "Capturar" (tira a foto via `<canvas>`) e "Cancelar" (fecha e para a câmera)
- Após captura, mostra preview com opções "Usar esta foto" e "Tirar novamente"
- A foto capturada é recortada na proporção 3x4 e convertida para `File` (blob JPEG) para ser usada no upload existente

### 2. Atualizar o formulário de aluno em `Students.tsx`

**Arquivo**: `src/pages/Students.tsx` (linhas 596-618)

- Adicionar um segundo botão ao lado do "Upload Foto": **"Tirar Foto"** com ícone `Camera`
- Ao clicar, abre o `CameraPhotoCapture` dialog
- Quando a foto é capturada, seta `photoFile` e `photoPreview` com o resultado (mesmo fluxo do upload existente)
- O restante do fluxo de upload para o storage permanece inalterado

### Layout dos botões de foto

```text
[Preview circular]  |  [Upload Foto]
                    |  [Tirar Foto]   ← NOVO
```

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/CameraPhotoCapture.tsx` | Novo componente com câmera + moldura 3x4 |
| `src/pages/Students.tsx` | Adicionar botão "Tirar Foto" que abre o componente de câmera |

