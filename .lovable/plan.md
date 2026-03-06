

# Plano: Corrigir importacao em lote - salvar todos de uma vez + associar turmas

## Problemas identificados

1. **Salvando um por um**: `handleSave` chama `addTeacher()` em loop. Cada `addTeacher` chama `fetchData()` internamente, causando N refetches para N professores - lento e com flickering.

2. **Turmas nao associadas**: A associacao de turmas depende do `result.id` retornado por `addTeacher`, mas o `fetchData()` dentro de `addTeacher` pode causar race conditions. Alem disso, ao atribuir o professor a TODAS as disciplinas sem professor de uma turma, o comportamento e excessivo - deveria ser mais controlado.

## Solucao

### `src/components/mapping/TeacherBulkImportDialog.tsx`

Reescrever `handleSave` para:

1. **Inserir todos os professores de uma vez** usando `supabase.from('mapping_teachers').insert([...]).select()` - um unico request ao banco retornando todos os IDs
2. **Associar turmas em batch**: Para cada professor com turmas, buscar `mapping_classes` pelo nome e atualizar `mapping_class_subjects` sem professor
3. **Chamar `refreshData()` uma unica vez** no final

Nao usar `addTeacher` do contexto. Usar insert direto no Supabase para evitar os N `fetchData()`.

### `src/contexts/SchoolMappingContext.tsx`

Expor `getNextColor` de forma que o dialog consiga calcular cores para N professores. Ja esta exposto, mas precisamos gerar N cores de uma vez. O dialog calculara as cores localmente usando a mesma logica.

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/mapping/TeacherBulkImportDialog.tsx` | Insert em batch + associacao de turmas em batch + refreshData uma vez |

