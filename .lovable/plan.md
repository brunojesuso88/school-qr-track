

# Plano: Foto da Turma + Indicador de Chamada Diaria

## 1. Migração: adicionar coluna `photo_url` na tabela `classes`

```sql
ALTER TABLE public.classes ADD COLUMN photo_url text;
```

## 2. Storage: criar bucket `class-photos`

Bucket publico para fotos de turma (ou privado com signed URLs — seguir padrao do `student-photos` que é privado).

## 3. `src/pages/Classes.tsx`

### Foto da turma no formulário de edição
- Adicionar campo `photo_url` ao `formData`
- No dialog de criar/editar, adicionar input de upload de foto (visível ao editar)
- Ao selecionar arquivo, fazer upload para bucket `class-photos`, salvar URL no campo `photo_url`
- No card, substituir o ícone `GraduationCap` pela foto da turma quando existir

### Indicador de chamada diária no card
- Ao carregar as turmas, buscar da tabela `attendance` os registros do dia atual agrupados por classe dos alunos
- Cruzar com a lista de turmas: se existe pelo menos 1 registro de attendance hoje para alunos daquela turma → "Frequência OK" (verde), senão → "Frequência não realizada" (vermelho)
- Exibir badge/indicador no card de cada turma

Logica de busca:
```typescript
// Buscar attendance de hoje com a classe do aluno
const { data } = await supabase
  .from('attendance')
  .select('student_id, students!inner(class)')
  .eq('date', todayStr);

// Construir set de turmas com chamada feita
const classesWithAttendance = new Set(data?.map(a => a.students.class));
```

### Callback no `ClassAttendanceDialog`
- Ao salvar chamada com sucesso (`onSuccess`), re-buscar o status de attendance para atualizar os badges sem reload completo

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar `photo_url` na tabela `classes` + bucket `class-photos` |
| `src/pages/Classes.tsx` | Upload de foto no edit, exibir foto no card, badge de frequência diária |

