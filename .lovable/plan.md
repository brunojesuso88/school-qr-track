
# Plano: Correcao do Salvamento de Disponibilidade e Resumo no Card

## Analise dos Problemas

### Problema 1: Disponibilidade Nao Salva

**Causa Raiz Identificada:**

No `TeacherForm.tsx`, quando o usuario seleciona um turno, o `availabilityByShift[turno]` comeca como um array vazio `[]`. O componente `TeacherAvailabilityGrid` inicializa internamente todas as celulas como "disponivel", mas so chama `onChange` quando o usuario clica em alguma celula.

```typescript
// TeacherForm.tsx - Estado inicial
const [availabilityByShift, setAvailabilityByShift] = useState<Record<string, AvailabilityCell[]>>({
  morning: [],    // <-- Vazio! Mesmo que o grid mostre tudo verde
  afternoon: [],
  evening: []
});
```

**Fluxo do Bug:**
1. Usuario seleciona turno "Manha" 
2. `availabilityByShift.morning` = [] (vazio)
3. Grid renderiza tudo verde (default interno)
4. Usuario NAO clica em nenhuma celula
5. Ao salvar, `availability.forEach(cell => ...)` itera sobre array vazio
6. Nenhum registro e inserido no banco

---

### Problema 2: Falta Resumo de Disponibilidade

O `TeacherSummarySheet.tsx` nao busca nem exibe os dados de disponibilidade do professor.

---

## Solucao Proposta

### Parte 1: Corrigir Salvamento - TeacherForm.tsx

**Alteracao 1:** Inicializar disponibilidade completa ao selecionar um turno

```typescript
const handleShiftToggle = (shift: string, checked: boolean) => {
  if (checked) {
    const newShifts = [...selectedShifts, shift];
    setSelectedShifts(newShifts);
    
    // Inicializar disponibilidade completa se estiver vazia
    if (!availabilityByShift[shift] || availabilityByShift[shift].length === 0) {
      const fullAvailability: AvailabilityCell[] = [];
      for (let day = 1; day <= 5; day++) {
        for (let period = 1; period <= 6; period++) {
          fullAvailability.push({ day, period, available: true });
        }
      }
      setAvailabilityByShift(prev => ({
        ...prev,
        [shift]: fullAvailability
      }));
    }
    
    if (selectedShifts.length === 0) {
      setCurrentShiftTab(shift);
    }
  } else {
    // ... resto do codigo
  }
};
```

**Alteracao 2:** Garantir que ao carregar dados existentes, turnos vazios sejam inicializados

No useEffect de carregamento, se um turno nao tem dados salvos, inicializar com disponibilidade completa.

---

### Parte 2: Adicionar Resumo de Disponibilidade - TeacherSummarySheet.tsx

**Adicionar busca de disponibilidade:**

```typescript
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X } from "lucide-react";

// Dentro do componente:
const [availability, setAvailability] = useState<{
  morning: number;
  afternoon: number;
  evening: number;
  total: number;
} | null>(null);

useEffect(() => {
  const loadAvailability = async () => {
    if (!teacher?.id) return;
    
    const { data } = await supabase
      .from("teacher_availability")
      .select("*")
      .eq("teacher_id", teacher.id);
    
    if (data && data.length > 0) {
      // Contar slots disponiveis por turno
      let morning = 0, afternoon = 0, evening = 0;
      
      data.forEach(row => {
        if (row.available) {
          if (row.period_number <= 6) morning++;
          else if (row.period_number <= 12) afternoon++;
          else evening++;
        }
      });
      
      setAvailability({
        morning,
        afternoon,
        evening,
        total: morning + afternoon + evening
      });
    } else {
      setAvailability(null);
    }
  };
  
  loadAvailability();
}, [teacher?.id]);
```

**Adicionar visualizacao na UI:**

```tsx
{/* Disponibilidade - Novo Bloco */}
<Separator />

<div className="space-y-3">
  <p className="text-sm font-medium">Disponibilidade por Turno</p>
  
  {availability ? (
    <div className="grid grid-cols-3 gap-2">
      {availability.morning > 0 && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
          <p className="text-xs text-muted-foreground">Manha</p>
          <p className="text-sm font-medium text-green-600">{availability.morning}/30</p>
        </div>
      )}
      {availability.afternoon > 0 && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
          <p className="text-xs text-muted-foreground">Tarde</p>
          <p className="text-sm font-medium text-green-600">{availability.afternoon}/30</p>
        </div>
      )}
      {availability.evening > 0 && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
          <p className="text-xs text-muted-foreground">Noite</p>
          <p className="text-sm font-medium text-green-600">{availability.evening}/30</p>
        </div>
      )}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground py-2 text-center">
      Nenhuma disponibilidade configurada
    </p>
  )}
</div>
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/mapping/TeacherForm.tsx` | Inicializar disponibilidade completa ao selecionar turno |
| `src/components/mapping/TeacherSummarySheet.tsx` | Adicionar busca e exibicao do resumo de disponibilidade |

---

## Fluxo Corrigido

```text
ANTES:
1. Seleciona turno -> availabilityByShift[turno] = []
2. Grid exibe verde (default interno) 
3. Salva -> Nada inserido no banco

DEPOIS:
1. Seleciona turno -> Inicializa 30 slots como disponiveis
2. Grid exibe verde (dados reais)
3. Salva -> 30 registros inseridos no banco
```

---

## Layout do Resumo de Disponibilidade

```text
+------------------------------------------+
|  Disponibilidade por Turno               |
|                                          |
|  +----------+  +----------+  +----------+|
|  |  Manha   |  |  Tarde   |  |  Noite   ||
|  |  28/30   |  |  30/30   |  |  15/30   ||
|  +----------+  +----------+  +----------+|
|                                          |
+------------------------------------------+

Legenda: X/30 = X slots disponiveis de 30 possiveis (5 dias x 6 horarios)
```
