
# Plano: Reestruturar Distribuição com Cards de Turmas e Batch Save

## Visão Geral

Transformar a página de Distribuição para exibir cards compactos de turmas. Ao clicar em um card, abre um diálogo modal mostrando as disciplinas da turma com possibilidade de atribuir/desatribuir professores usando salvamento em lote.

---

## Alterações

### Arquivo: `src/pages/mapping/MappingDistribution.tsx`

**1. Novo Layout - Grid de Cards de Turmas**

Cada card mostra:
- Nome da turma
- Badge do turno
- Contagem de disciplinas atribuídas / total
- Barra de progresso de atribuição

**2. Criar Componente de Diálogo Interno**

Um diálogo modal que aparece ao clicar no card da turma, mostrando:
- Header com nome da turma e estatísticas
- Lista de disciplinas com botões de atribuição
- Dropdown/lista de professores elegíveis para cada disciplina
- Footer com botões "Descartar" e "Salvar (N)"

**3. Implementar Estado de Alterações Pendentes**

Similar ao `TeacherAssociationDialog`, usar um array de `pendingChanges` para rastrear atribuições/desatribuições antes de salvar.

---

## Estrutura do Código

```tsx
interface PendingChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  newTeacherId?: string;
  previousTeacherId?: string | null;
}

const MappingDistributionContent = () => {
  const [selectedClass, setSelectedClass] = useState<MappingClass | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Cards de turmas clicáveis
  // Diálogo de atribuição por turma
  // Lógica de batch save
};
```

---

## Fluxo de Interação

```text
+---------------------+     +---------------------------+
|   Cards de Turmas   | --> | Diálogo: Disciplinas da   |
|   [Clique para      |     | Turma + Atribuição        |
|    abrir]           |     +---------------------------+
+---------------------+     |                           |
                            | Disciplina 1  [Prof. A ▼] |
                            | Disciplina 2  [Atribuir]  |
                            | Disciplina 3  [Prof. B ▼] |
                            |                           |
                            | [Descartar] [Salvar (2)]  |
                            +---------------------------+
```

---

## Detalhes Técnicos

### Card da Turma

```tsx
<Card 
  className="cursor-pointer hover:shadow-md transition-shadow"
  onClick={() => setSelectedClass(classData)}
>
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-lg">{classData.name}</CardTitle>
      <Badge variant="outline">{SHIFT_LABELS[classData.shift]}</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between text-sm mb-2">
      <span className="text-muted-foreground">Disciplinas atribuídas</span>
      <span className="font-medium">{assignedCount}/{totalCount}</span>
    </div>
    <Progress value={progressPercent} />
  </CardContent>
</Card>
```

### Diálogo de Atribuição por Turma

Exibir lista de disciplinas da turma selecionada, cada uma com:
- Nome da disciplina e carga horária
- Dropdown/Popover para selecionar professor
- Badge do professor atual (se atribuído)
- Botão "Remover" para desatribuir

### Lógica de Atribuição

```tsx
const handleAssign = (classSubjectId: string, teacherId: string, previousTeacherId?: string | null) => {
  const filtered = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
  setPendingChanges([
    ...filtered,
    { classSubjectId, action: 'assign', newTeacherId: teacherId, previousTeacherId }
  ]);
};

const handleUnassign = (classSubjectId: string, currentTeacherId: string) => {
  const filtered = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
  setPendingChanges([
    ...filtered,
    { classSubjectId, action: 'unassign', previousTeacherId: currentTeacherId }
  ]);
};
```

### Batch Save

```tsx
const handleSaveAll = async () => {
  setIsSaving(true);
  try {
    for (const change of pendingChanges) {
      if (change.action === 'unassign') {
        await unassignTeacher(change.classSubjectId);
      } else if (change.action === 'assign' && change.newTeacherId) {
        if (change.previousTeacherId) {
          await unassignTeacher(change.classSubjectId);
        }
        await assignTeacher(change.classSubjectId, change.newTeacherId);
      }
    }
    toast({ title: "Atribuições salvas", description: `${pendingChanges.length} alteração(ões)` });
    setPendingChanges([]);
    setSelectedClass(null);
  } catch (error) {
    toast({ title: "Erro", description: error.message, variant: "destructive" });
  } finally {
    setIsSaving(false);
  }
};
```

---

## Componentes Reutilizados

| Componente | Uso |
|------------|-----|
| `Card` | Cards de turmas |
| `Dialog` | Modal de atribuição |
| `ScrollArea` | Lista de disciplinas com scroll |
| `Badge` | Turno, professor atribuído, status pendente |
| `Progress` | Progresso de atribuição no card |
| `Popover` + lista | Seleção de professor |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingDistribution.tsx` | Reestruturar para cards + diálogo com batch save |

---

## Interface Resultante

**Antes:** Cards expandidos com todas as disciplinas visíveis inline

**Depois:**
1. Grid de cards compactos de turmas (progresso visual)
2. Clique abre diálogo modal da turma
3. No diálogo: lista de disciplinas com seletor de professor
4. Botão "Salvar" aplica todas as alterações de uma vez
