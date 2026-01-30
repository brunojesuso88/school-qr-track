

# Plano: Correção de Refresh ao Trocar Aba e Múltiplas Requisições no Salvamento

## Análise dos Problemas

### Problema 1: Refresh ao Trocar de Aba no Windows

**Causa Raiz Identificada:**

No arquivo `src/components/UpdatePrompt.tsx` (linhas 33-40), há um listener que reage a mudanças do controller do Service Worker:

```typescript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!refreshing) {
    refreshing = true;
    window.location.reload();  // <-- Causa do refresh automático
  }
});
```

Este comportamento pode ser acionado quando:
1. Uma nova versão do Service Worker é instalada em background
2. O usuário troca de aba e ao voltar, o novo SW assume o controle
3. O autoUpdate do VitePWA (configurado em `vite.config.ts`) detecta atualizações

O PWA está configurado com `registerType: 'autoUpdate'` que atualiza automaticamente o Service Worker em background, e quando o novo SW toma controle, o listener força um reload.

---

### Problema 2: Múltiplas Requisições ao Salvar Atribuições

**Causa Raiz Identificada:**

Nos arquivos `MappingDistribution.tsx` e `TeacherAssociationDialog.tsx`, a função `handleSaveAll` processa as mudanças sequencialmente:

```typescript
for (const change of pendingChanges) {
  if (change.action === 'unassign') {
    await unassignTeacher(change.classSubjectId);  // 1 requisição + fetchData()
  } else if (change.action === 'assign' && change.newTeacherId) {
    if (change.previousTeacherId) {
      await unassignTeacher(change.classSubjectId);  // 1 requisição + fetchData()
    }
    await assignTeacher(change.classSubjectId, change.newTeacherId);  // 1 requisição + fetchData()
  }
}
```

E no `SchoolMappingContext.tsx`, cada função `assignTeacher` e `unassignTeacher` chama `fetchData()` após cada operação:

```typescript
const assignTeacher = async (classSubjectId: string, teacherId: string) => {
  // ... operações no banco
  await fetchData();  // Refetch de TODAS as tabelas a cada operação
};
```

**Resultado:** Para 3 mudanças pendentes, podem ocorrer 6+ chamadas ao banco e 6+ refetches completos.

---

## Solução Proposta

### Parte 1: Remover Reload Automático no controllerchange

Modificar o `UpdatePrompt.tsx` para NÃO fazer reload automático quando o controller mudar. Em vez disso, apenas mostrar o prompt de atualização.

**Arquivo:** `src/components/UpdatePrompt.tsx`

**Alteração:** Remover ou modificar o listener de `controllerchange` para apenas mostrar o prompt em vez de recarregar automaticamente.

```typescript
// ANTES
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!refreshing) {
    refreshing = true;
    window.location.reload();
  }
});

// DEPOIS
navigator.serviceWorker.addEventListener('controllerchange', () => {
  // Nova versão assumiu controle, mostrar prompt ao invés de reload
  if (!refreshing) {
    setNeedRefresh(true);
    setShowPrompt(true);
  }
});
```

---

### Parte 2: Otimizar Salvamento em Lote (Batch Save)

Criar funções de batch no contexto que fazem todas as operações em uma única transação e chamam `fetchData()` apenas uma vez no final.

#### Alteração 1: `src/contexts/SchoolMappingContext.tsx`

Adicionar novas funções de batch:

```typescript
interface BatchChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  newTeacherId?: string;
  previousTeacherId?: string | null;
}

// Nova função para salvar todas as mudanças em lote
const batchSaveAssignments = async (changes: BatchChange[]) => {
  // Agrupar operações por tipo para minimizar queries
  const unassigns: { classSubjectId: string; teacherId: string }[] = [];
  const assigns: { classSubjectId: string; teacherId: string }[] = [];
  
  for (const change of changes) {
    if (change.action === 'unassign' && change.previousTeacherId) {
      unassigns.push({
        classSubjectId: change.classSubjectId,
        teacherId: change.previousTeacherId
      });
    } else if (change.action === 'assign' && change.newTeacherId) {
      if (change.previousTeacherId) {
        unassigns.push({
          classSubjectId: change.classSubjectId,
          teacherId: change.previousTeacherId
        });
      }
      assigns.push({
        classSubjectId: change.classSubjectId,
        teacherId: change.newTeacherId
      });
    }
  }
  
  // Processar todas as desatribuições de uma vez
  if (unassigns.length > 0) {
    const unassignIds = unassigns.map(u => u.classSubjectId);
    await supabase
      .from('mapping_class_subjects')
      .update({ teacher_id: null })
      .in('id', unassignIds);
    
    // Atualizar horas dos professores
    const teacherHourUpdates = new Map<string, number>();
    for (const unassign of unassigns) {
      const cs = classSubjects.find(c => c.id === unassign.classSubjectId);
      if (cs) {
        const current = teacherHourUpdates.get(unassign.teacherId) || 0;
        teacherHourUpdates.set(unassign.teacherId, current - cs.weekly_classes);
      }
    }
    
    for (const [teacherId, hoursDelta] of teacherHourUpdates) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        await supabase
          .from('mapping_teachers')
          .update({ current_hours: Math.max(0, teacher.current_hours + hoursDelta) })
          .eq('id', teacherId);
      }
    }
  }
  
  // Processar todas as atribuições de uma vez
  if (assigns.length > 0) {
    for (const assign of assigns) {
      await supabase
        .from('mapping_class_subjects')
        .update({ teacher_id: assign.teacherId })
        .eq('id', assign.classSubjectId);
    }
    
    // Atualizar horas dos professores
    const teacherHourUpdates = new Map<string, number>();
    for (const assign of assigns) {
      const cs = classSubjects.find(c => c.id === assign.classSubjectId);
      if (cs) {
        const current = teacherHourUpdates.get(assign.teacherId) || 0;
        teacherHourUpdates.set(assign.teacherId, current + cs.weekly_classes);
      }
    }
    
    for (const [teacherId, hoursDelta] of teacherHourUpdates) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        await supabase
          .from('mapping_teachers')
          .update({ current_hours: teacher.current_hours + hoursDelta })
          .eq('id', teacherId);
      }
    }
  }
  
  // Único fetchData no final
  await fetchData();
};
```

#### Alteração 2: `src/pages/mapping/MappingDistribution.tsx`

Usar a nova função de batch:

```typescript
const handleSaveAll = async () => {
  if (pendingChanges.length === 0) return;
  
  setIsSaving(true);
  try {
    await batchSaveAssignments(pendingChanges);
    toast({ 
      title: "Atribuições salvas", 
      description: `${pendingChanges.length} alteração(ões) aplicada(s)` 
    });
    setPendingChanges([]);
    setSelectedClass(null);
  } catch (error: any) {
    toast({ 
      title: "Erro ao salvar", 
      description: error.message, 
      variant: "destructive" 
    });
  } finally {
    setIsSaving(false);
  }
};
```

#### Alteração 3: `src/components/mapping/TeacherAssociationDialog.tsx`

Aplicar a mesma lógica de batch save.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/UpdatePrompt.tsx` | Remover reload automático em `controllerchange`, apenas mostrar prompt |
| `src/contexts/SchoolMappingContext.tsx` | Adicionar função `batchSaveAssignments` para salvar todas as mudanças de uma vez |
| `src/pages/mapping/MappingDistribution.tsx` | Usar `batchSaveAssignments` em vez de loop com chamadas individuais |
| `src/components/mapping/TeacherAssociationDialog.tsx` | Usar `batchSaveAssignments` em vez de loop com chamadas individuais |

---

## Benefícios

1. **Problema 1 (Refresh)**: A página não será mais recarregada automaticamente ao trocar de aba. O usuário verá o prompt de atualização e poderá escolher quando atualizar.

2. **Problema 2 (Múltiplas requisições)**:
   - Redução de N chamadas de `fetchData()` para apenas 1
   - Operações de update agrupadas quando possível
   - Melhor performance e UX (menos flickering na UI)
   - Menos carga no banco de dados

---

## Diagrama do Fluxo Otimizado

```text
ANTES (N mudanças):
┌─────────────────────────────────────────────────────┐
│ for cada mudança:                                   │
│   → unassign → fetchData() → UI atualiza           │
│   → assign → fetchData() → UI atualiza             │
│ Total: 2N requisições + 2N refetches               │
└─────────────────────────────────────────────────────┘

DEPOIS (N mudanças):
┌─────────────────────────────────────────────────────┐
│ batchSaveAssignments(mudanças)                      │
│   → Agrupa todas as desatribuições                 │
│   → Agrupa todas as atribuições                    │
│   → fetchData() uma única vez                      │
│ Total: ~4 requisições + 1 refetch                  │
└─────────────────────────────────────────────────────┘
```

