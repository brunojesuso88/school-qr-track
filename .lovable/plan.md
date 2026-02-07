

# Plano: Disciplinas reordenaveis com drag-and-drop na Distribuicao

## Visao Geral

Ao abrir o dialog de uma turma na Distribuicao, as disciplinas serao exibidas como cards arrataveis (drag-and-drop). O usuario pode reorganizar a ordem e salvar essa ordem no banco de dados.

---

## 1. Adicionar coluna `sort_order` na tabela `mapping_class_subjects`

Uma migracao SQL para adicionar a coluna que armazena a posicao de cada disciplina por turma:

```sql
ALTER TABLE mapping_class_subjects 
ADD COLUMN sort_order integer DEFAULT 0;
```

---

## 2. Alterar `src/pages/mapping/MappingDistribution.tsx`

### 2.1 Adicionar imports do dnd-kit (ja instalado no projeto)

Importar `DndContext`, `closestCenter`, `KeyboardSensor`, `PointerSensor`, `useSensor`, `useSensors` de `@dnd-kit/core`, e `SortableContext`, `verticalListSortingStrategy`, `useSortable`, `arrayMove` de `@dnd-kit/sortable`, e `CSS` de `@dnd-kit/utilities`.

### 2.2 Criar componente `SortableSubjectCard`

Um componente interno que encapsula cada disciplina existente (linhas 274-426) com funcionalidade de drag usando `useSortable`. Tera um handle de arraste (icone de grip) no lado esquerdo do card.

### 2.3 Estado local de ordem

Quando o dialog abre (`selectedClass` muda), inicializar um estado `orderedSubjects` com os subjects da turma ordenados por `sort_order` (e fallback para SUBJECT_ORDER). Manter um flag `orderChanged` para rastrear se houve reordenacao.

### 2.4 Handler de reordenacao

Ao finalizar o drag (`onDragEnd`), usar `arrayMove` para atualizar `orderedSubjects` e marcar `orderChanged = true`.

### 2.5 Botao de salvar ordem

Quando `orderChanged` for true, exibir um botao "Salvar Ordem" no footer do dialog (ao lado dos botoes existentes). Ao clicar, faz update no banco:

```typescript
// Para cada subject, atualizar sort_order com o indice atual
const updates = orderedSubjects.map((s, index) => 
  supabase.from('mapping_class_subjects')
    .update({ sort_order: index })
    .eq('id', s.id)
);
```

### 2.6 Ajustar `getClassSubjects`

Alterar a funcao para ordenar primeiro por `sort_order` e usar `SUBJECT_ORDER` apenas como fallback para disciplinas com `sort_order = 0` (sem ordem personalizada definida).

---

## 3. Detalhes Tecnicos

| Item | Detalhe |
|------|---------|
| Biblioteca | `@dnd-kit/core` + `@dnd-kit/sortable` (ja instaladas) |
| Persistencia | Coluna `sort_order` em `mapping_class_subjects` |
| Arquivo alterado | `src/pages/mapping/MappingDistribution.tsx` |
| Migracao SQL | Adicionar coluna `sort_order integer DEFAULT 0` |

