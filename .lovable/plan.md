

# Plano: Importar Professores com Turmas via PDF

## Problema

A Edge Function `parse-teachers-pdf` extrai apenas nome, email, telefone e carga horaria. Nao extrai as turmas associadas a cada professor. Apos importar, os professores ficam sem nenhuma atribuicao de turma.

## Solucao

### 1. Edge Function: `supabase/functions/parse-teachers-pdf/index.ts`

Atualizar o prompt da IA e o schema da tool call para extrair tambem um campo `classes` (array de nomes de turma) para cada professor:

```
// Novo campo no schema
classes: { type: 'array', items: { type: 'string' }, description: 'Nomes das turmas (ex: 1A, 2B, 3C)' }
```

O prompt sera atualizado para instruir a IA a identificar as turmas/classes associadas a cada professor no PDF.

O retorno incluira `classes: string[]` em cada professor.

### 2. Dialog: `src/components/mapping/TeacherBulkImportDialog.tsx`

- Adicionar campo `classes: string[]` na interface `ExtractedTeacher`
- Exibir as turmas como Badges na tela de revisao de cada professor
- No `handleSave`, apos adicionar o professor via `addTeacher`, buscar as turmas correspondentes em `mapping_classes` pelo nome e atribuir o professor a todas as disciplinas sem professor nessas turmas via `assignTeacher`

Fluxo do save:
1. `addTeacher(...)` retorna o `id` do novo professor
2. Para cada turma extraida do PDF, buscar `mapping_classes` pelo nome
3. Para cada classe encontrada, buscar `mapping_class_subjects` sem `teacher_id`
4. Atribuir o professor a essas disciplinas

### 3. Contexto: `src/contexts/SchoolMappingContext.tsx`

A funcao `addTeacher` ja retorna `{ id: string }`, entao pode ser usada diretamente. Nenhuma alteracao necessaria no contexto.

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/parse-teachers-pdf/index.ts` | Adicionar extracao de turmas no prompt e schema |
| `src/components/mapping/TeacherBulkImportDialog.tsx` | Mostrar turmas na revisao + atribuir disciplinas ao salvar |

