

## Plano: Remover Foto + Câmera Traseira Padrão

### Alterações em `src/pages/Students.tsx`

1. **Adicionar estado para remover foto:**
   - Adicionar `removePhoto` state (boolean)
   - Quando editar aluno com foto existente, mostrar botão "Remover Foto" ao lado dos botões de Upload/Tirar Foto
   - Ao clicar em Remover: limpa `photoPreview`, `photoFile`, seta `removePhoto=true`
   - No `handleSubmit`: se `removePhoto=true`, seta `photo_url: null` no update

2. **Lógica de update com remoção:**
   - Se `editingStudent && removePhoto`: incluir `photo_url: null` no `updateData`

### Alterações em `src/components/CameraPhotoCapture.tsx`

1. **Câmera traseira como padrão:**
   - Alterar estado inicial de `facingMode` de `'user'` para `'environment'`
   - Alterar `startCamera('user')` para `startCamera('environment')` no `useEffect`

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Students.tsx` | Botão "Remover Foto" + lógica de remoção no submit |
| `src/components/CameraPhotoCapture.tsx` | Câmera traseira (`environment`) como padrão |

