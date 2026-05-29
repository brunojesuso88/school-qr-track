# Plano de Ajustes

## 1. Gestão de Alunos — Botão "Atualizar Aluno" travado após upload de foto

### Diagnóstico
Em `src/pages/Students.tsx`:
- O modal de Câmera (`CameraPhotoCapture`) está renderizado **dentro do `<form>`** do aluno (linha ~651). Como é um Radix Dialog (overlay modal), seu estado de "aberto"/foco pode interferir no formulário-pai e, em alguns casos, capturar o clique do botão Submit ou bloquear interação com o form até ser totalmente desmontado.
- Além disso, ao editar um aluno, `photoPreview` recebe a URL assinada da foto existente. Se o usuário clica em "Upload" e seleciona um novo arquivo, `handlePhotoSelect` define `photoFile`, mas **não reseta `removePhoto`**, o que pode deixar inconsistências em estados anteriores.
- O Input está recebendo `value={null}` para `guardian_name`/`guardian_phone` em alguns alunos (warning no console), o que não trava o submit mas indica formData mal inicializado.

### Correções
1. **Mover `<CameraPhotoCapture />` para fora do `<form>`** (renderizar como irmão do Dialog ou no fim do componente), evitando que o Dialog aninhado bloqueie o submit.
2. Em `handlePhotoSelect`, garantir `setRemovePhoto(false)` quando um novo arquivo é escolhido.
3. Em `handleSubmit`, normalizar o estado: garantir que `setIsUploadingPhoto(false)` está no `finally` (já está, manter) e logar erro completo via toast em caso de falha de validação/Supabase para o usuário ver o motivo.
4. Inicializar `formData.guardian_name` e `guardian_phone` sempre como `""` (nunca `null`) em `handleEdit` para eliminar o warning de input controlado.

## 2. Mapeamento Escolar — Abreviação para cada Disciplina

### Banco de dados
Adicionar coluna `abbreviation` (TEXT, nullable) em `mapping_global_subjects` via migration.

### Tipos e Contexto
- Adicionar `abbreviation?: string | null` em `MappingGlobalSubject` (`src/contexts/SchoolMappingContext.tsx`).

### UI — Cadastro/Edição
Em `src/components/mapping/SubjectForm.tsx`:
- Novo campo "Abreviação" (input curto, ex.: "MAT", "POR"), opcional, máximo 10 caracteres.
- Enviar `abbreviation` no `addGlobalSubject` / `updateGlobalSubject`.

### UI — Listagem
Em `src/pages/mapping/MappingSubjects.tsx`:
- Exibir a abreviação ao lado do nome (badge): `Matemática · MAT`.

### Identificação por abreviação
Onde a disciplina é selecionada/exibida (ex.: `ClassSubjectsDialog`, exports PDF, distribuição):
- Mostrar `name (abreviação)` no `SelectItem` e badges.
- Em buscas/filtros que comparam nome, aceitar match por `name` **ou** `abbreviation` (case-insensitive).

> Observação: a tabela `mapping_class_subjects` continua referenciando `subject_name`. A abreviação é apenas metadata em `mapping_global_subjects` e é resolvida na UI a partir do nome.

## Arquivos afetados
- `src/pages/Students.tsx`
- Nova migration em `supabase/migrations/` (adiciona coluna `abbreviation`)
- `src/contexts/SchoolMappingContext.tsx`
- `src/components/mapping/SubjectForm.tsx`
- `src/pages/mapping/MappingSubjects.tsx`
- `src/components/mapping/ClassSubjectsDialog.tsx` (exibir abreviação)
