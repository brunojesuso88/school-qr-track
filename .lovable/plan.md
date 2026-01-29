

# Plano: Ajustar Formulário de Professores

## Resumo das Alterações

1. Remover a seção "Turnos Disponíveis" do formulário de professor
2. Adicionar barra de rolagem (ScrollArea) na caixa de diálogo

---

## Alterações Detalhadas

### 1. Remover "Turnos Disponíveis"

**Arquivo**: `src/components/mapping/TeacherForm.tsx`

**Remover**:
- Constante `SHIFTS` (linhas 18-22)
- Estado `availability` e função `toggleShift` (linhas 33, 109-115)
- Validação de `availability.length === 0` no submit (linhas 50-53)
- Bloco JSX da seção "Turnos Disponíveis" (linhas 167-183)
- Referência a `availability` no objeto `data` (linha 63)

**Ajuste na Lógica**:
- Como os turnos serão derivados do `TeacherAvailabilitySection`, vamos manter uma disponibilidade padrão ou calcular automaticamente com base na grid de horários

---

### 2. Adicionar ScrollArea na Dialog

**Arquivo**: `src/pages/mapping/MappingTeachers.tsx`

**Alteração**: Envolver o conteúdo do `DialogContent` com `ScrollArea` para permitir rolagem quando o formulário for muito grande.

**De**:
```typescript
<DialogContent className="max-w-lg">
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  <TeacherForm ... />
</DialogContent>
```

**Para**:
```typescript
<DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  <ScrollArea className="flex-1 pr-4">
    <TeacherForm ... />
  </ScrollArea>
</DialogContent>
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/mapping/TeacherForm.tsx` | Remover seção "Turnos Disponíveis" |
| `src/pages/mapping/MappingTeachers.tsx` | Adicionar ScrollArea na Dialog |

---

## Seção Tecnica

### Importações Necessárias

Em `MappingTeachers.tsx`:
```typescript
import { ScrollArea } from "@/components/ui/scroll-area";
```

### Lógica de Disponibilidade

Após remover os "Turnos Disponíveis", o campo `availability` do professor será definido automaticamente baseado na grid de disponibilidade detalhada, ou um valor padrão como `["morning", "afternoon", "evening"]` será usado para manter compatibilidade com outros componentes que dependem desse campo.

