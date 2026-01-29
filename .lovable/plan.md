

# Plano: Associar Disciplinas Diretamente no Card do Professor

## Resumo

Remover a selecao de "Disciplinas que leciona" do formulario de edicao de professores e adicionar um novo botao "Associar disciplina" no card do professor. Ao clicar, abre uma caixa de dialogo mostrando todas as turmas e suas disciplinas, permitindo que o usuario atribua o professor diretamente, com opcao de substituir outro professor ja atribuido.

---

## Alteracoes

### 1. Remover "Disciplinas que leciona" do Formulario

**Arquivo**: `src/components/mapping/TeacherForm.tsx`

Remover o bloco de codigo das linhas 157-179 que contem a secao de disciplinas com checkboxes. Tambem remover o estado `subjects` e a funcao `toggleSubject` que nao serao mais necessarios.

---

### 2. Adicionar Botao "Associar disciplina" no Card

**Arquivo**: `src/pages/mapping/MappingTeachers.tsx`

Adicionar um novo botao ao lado dos botoes de editar e excluir no card do professor:

```
[Icone Livro] Associar disciplina
```

---

### 3. Criar Dialogo de Associacao

**Arquivo**: `src/pages/mapping/MappingTeachers.tsx`

Criar um novo dialogo que exibe:

- Cabecalho com nome do professor selecionado
- Lista de turmas agrupadas por turno
- Para cada turma, lista de disciplinas mostrando:
  - Nome da disciplina
  - Quantidade de aulas semanais
  - Se ja tem professor atribuido: mostra nome + botao "Substituir"
  - Se nao tem professor: botao "Atribuir"

**Estrutura visual**:

```text
+------------------------------------------+
|  Associar disciplina                     |
|  Prof. Maria Silva                       |
+------------------------------------------+
|                                          |
|  MANHA                                   |
|  ----------------------------------------|
|  Turma 1A                                |
|    Matematica (4h)         [Atribuir]    |
|    Portugues (4h)  Joao    [Substituir]  |
|    ...                                   |
|  ----------------------------------------|
|  Turma 2A                                |
|    Historia (3h)           [Atribuir]    |
|    ...                                   |
|                                          |
|  TARDE                                   |
|  ----------------------------------------|
|  ...                                     |
+------------------------------------------+
```

---

### 4. Logica de Substituicao

Quando o usuario clica em "Substituir":
1. Primeiro remove o professor atual da disciplina (usando `unassignTeacher`)
2. Depois atribui o novo professor (usando `assignTeacher`)

Quando o usuario clica em "Atribuir":
1. Atribui diretamente o professor selecionado

---

## Validacoes

| Situacao | Comportamento |
|----------|---------------|
| Professor nao disponivel no turno | Disciplina aparece desabilitada |
| Atribuicao excederia carga horaria | Botao desabilitado com aviso |
| Disciplina ja atribuida ao mesmo professor | Mostra "Ja atribuido" |

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/mapping/TeacherForm.tsx` | Remover secao de disciplinas e codigo relacionado |
| `src/pages/mapping/MappingTeachers.tsx` | Adicionar botao e dialogo de associacao |

---

## Secao Tecnica

### Estrutura do novo estado

```typescript
const [associatingTeacher, setAssociatingTeacher] = useState<MappingTeacher | null>(null);
const [isAssociating, setIsAssociating] = useState(false);
```

### Funcao de substituicao

```typescript
const handleAssignOrReplace = async (classSubjectId: string, currentTeacherId?: string) => {
  if (!associatingTeacher) return;
  
  setIsAssociating(true);
  try {
    // Se ja tem professor, remove primeiro
    if (currentTeacherId) {
      await unassignTeacher(classSubjectId);
    }
    // Atribui o novo professor
    await assignTeacher(classSubjectId, associatingTeacher.id);
    toast({ title: currentTeacherId ? "Professor substituido" : "Disciplina atribuida" });
  } catch (error: any) {
    toast({ title: "Erro", description: error.message, variant: "destructive" });
  } finally {
    setIsAssociating(false);
  }
};
```

### Agrupamento por turno

```typescript
const shiftGroups = {
  morning: classes.filter(c => c.shift === 'morning'),
  afternoon: classes.filter(c => c.shift === 'afternoon'),
  evening: classes.filter(c => c.shift === 'evening')
};
```

### Verificacao de disponibilidade

Mostrar apenas turmas/disciplinas onde o turno da turma esta na disponibilidade do professor.

