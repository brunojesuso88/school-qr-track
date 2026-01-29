

# Plano: Salvar Atribuições em Lote

## Resumo

Modificar o diálogo de associação de disciplinas para que as alterações sejam feitas localmente (em memória) e só persistidas no banco de dados quando o usuário clicar em um botão "Salvar" ao final.

---

## Como Vai Funcionar

| Ação | Comportamento Atual | Novo Comportamento |
|------|---------------------|-------------------|
| Clicar "Atribuir" | Salva imediatamente no banco | Marca localmente como pendente |
| Clicar "Substituir" | Salva imediatamente no banco | Marca localmente como pendente |
| Fechar diálogo | Alterações já salvas | Descarta alterações pendentes |
| Clicar "Salvar" | Não existe | Persiste todas as alterações no banco |

---

## Alterações

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**1. Adicionar estado local para alterações pendentes:**

```typescript
interface PendingChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  previousTeacherId?: string | null;
}

const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
```

**2. Criar estado local derivado das disciplinas:**

Manter uma cópia local das atribuições que reflete as alterações pendentes, para que a UI mostre o estado atualizado sem salvar no banco.

**3. Modificar `handleAssignOrReplace`:**

Em vez de chamar `assignTeacher`/`unassignTeacher`, apenas adiciona a alteração à lista de pendentes.

**4. Adicionar botão "Salvar" no rodapé:**

```
+------------------------------------------+
|  [Descartar]               [Salvar (3)]  |
+------------------------------------------+
```

O número entre parênteses mostra quantas alterações pendentes existem.

**5. Função `handleSaveAll`:**

Processa todas as alterações pendentes em uma única operação.

**6. Indicadores visuais:**

- Disciplinas com alterações pendentes mostram um indicador visual (borda colorida ou ícone)
- Badge mostrando "Pendente" em vez do estado atual

---

## Interface Atualizada

```text
+------------------------------------------+
|  Associar disciplinas                    |
|  Prof. Maria Silva (5h / 20h)            |
+------------------------------------------+
|                                          |
|  MANHÃ                                   |
|  ----------------------------------------|
|  Turma 1A                                |
|    Matemática (4h)  [✓ Pendente]         |
|    Português (4h)   João    [Substituir] |
|  ----------------------------------------|
|                                          |
+------------------------------------------+
|  [Descartar]               [Salvar (1)]  |
+------------------------------------------+
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/mapping/TeacherAssociationDialog.tsx` | Adicionar lógica de alterações pendentes, botões Salvar/Descartar, indicadores visuais |

---

## Seção Técnica

### Estrutura de dados para alterações pendentes

```typescript
interface PendingChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  previousTeacherId?: string | null;
}

const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
```

### Estado local derivado

```typescript
// Combina o estado real do banco com as alterações pendentes
const getLocalTeacherId = (classSubjectId: string): string | null | undefined => {
  const pending = pendingChanges.find(p => p.classSubjectId === classSubjectId);
  if (pending) {
    return pending.action === 'assign' ? teacher.id : null;
  }
  return classSubjects.find(cs => cs.id === classSubjectId)?.teacher_id;
};
```

### Calcular carga horária local

```typescript
const getLocalCurrentHours = (): number => {
  let hours = teacher.current_hours;
  
  pendingChanges.forEach(change => {
    const cs = classSubjects.find(c => c.id === change.classSubjectId);
    if (!cs) return;
    
    if (change.action === 'assign') {
      hours += cs.weekly_classes;
    } else if (change.action === 'unassign' && change.previousTeacherId === teacher.id) {
      hours -= cs.weekly_classes;
    }
  });
  
  return Math.max(0, hours);
};
```

### Função de salvar em lote

```typescript
const handleSaveAll = async () => {
  setIsSaving(true);
  try {
    for (const change of pendingChanges) {
      if (change.action === 'unassign' && change.previousTeacherId) {
        await unassignTeacher(change.classSubjectId);
      }
      if (change.action === 'assign') {
        await assignTeacher(change.classSubjectId, teacher.id);
      }
    }
    
    toast({ title: "Atribuições salvas", description: `${pendingChanges.length} alteração(ões) salva(s)` });
    setPendingChanges([]);
    onClose();
  } catch (error: any) {
    toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
  } finally {
    setIsSaving(false);
  }
};
```

### Resetar ao fechar

```typescript
const handleClose = () => {
  setPendingChanges([]);
  onClose();
};
```

