
# Plano: Reabrir Turma Apos Salvar e Ordenar Disciplinas

## Alteracoes em `src/pages/mapping/MappingDistribution.tsx`

### 1. Reabrir a turma apos salvar alteracoes

No `handleSaveAll` (linhas 100-122), atualmente apos salvar o codigo faz `setSelectedClass(null)` que fecha o dialog. A alteracao vai manter a turma aberta:

```typescript
// ANTES (linha 111-112):
setPendingChanges([]);
setSelectedClass(null);

// DEPOIS:
setPendingChanges([]);
// Manter selectedClass aberta (nao fechar o dialog)
```

### 2. Ordenar disciplinas com ordem fixa

Adicionar uma constante com a ordem desejada e uma funcao de ordenacao. As disciplinas serao ordenadas ao exibir no dialog da turma.

**Constante de ordem (adicionar no topo do arquivo):**

```typescript
const SUBJECT_ORDER = [
  "Arte",
  "Biologia",
  "Educação Física",
  "Filosofia",
  "Física",
  "Geografia",
  "História",
  "Língua Inglesa",
  "Português",
  "Matemática",
  "Química",
  "Sociologia",
  "Educação Digital",
  "Identidade e Protagonismo",
  "Aprofundamento I",
  "Aprofundamento II",
  "Let. em Português",
  "Let. em Matemática",
  "Eletiva de Base"
];
```

**Alterar `getClassSubjects` para retornar ordenado:**

```typescript
const getClassSubjects = (classId: string) => {
  const subjects = classSubjects.filter(cs => cs.class_id === classId);
  return subjects.sort((a, b) => {
    const indexA = SUBJECT_ORDER.indexOf(a.subject_name);
    const indexB = SUBJECT_ORDER.indexOf(b.subject_name);
    // Disciplinas nao listadas vao para o final, ordenadas alfabeticamente
    const orderA = indexA === -1 ? SUBJECT_ORDER.length : indexA;
    const orderB = indexB === -1 ? SUBJECT_ORDER.length : indexB;
    if (orderA !== orderB) return orderA - orderB;
    return a.subject_name.localeCompare(b.subject_name);
  });
};
```

---

## Resumo

| Alteracao | Local |
|-----------|-------|
| Manter dialog aberto apos salvar | `handleSaveAll` - remover `setSelectedClass(null)` |
| Ordenar disciplinas na ordem fixa | `getClassSubjects` - adicionar sort com `SUBJECT_ORDER` |
