

# Plano: Corrigir Barra de Rolagem na Seleção de Professor

## Problema Identificado

O componente `ScrollArea` já existe no código (linha 197), mas está usando `max-h-[300px]` que não funciona corretamente com o componente ScrollArea do Radix UI. O ScrollArea requer uma altura fixa definida para funcionar.

---

## Solução

**Arquivo**: `src/pages/mapping/MappingDistribution.tsx`

### Alteração

Mudar de `max-h-[300px]` para `h-[300px]` no ScrollArea:

**De**:
```typescript
<ScrollArea className="max-h-[300px]">
```

**Para**:
```typescript
<ScrollArea className="h-[300px]">
```

---

## Arquivo Afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingDistribution.tsx` | Corrigir altura do ScrollArea de `max-h` para `h` |

---

## Seção Técnica

### Por que max-h não funciona

O componente ScrollArea do Radix UI precisa de uma altura explícita (`h-[...]`) para calcular corretamente a área de rolagem. O uso de `max-h` (altura máxima) não define uma altura fixa, então o componente não consegue determinar quando mostrar a barra de rolagem.

Com `h-[300px]`, o container terá exatamente 300px de altura, e qualquer conteúdo que exceda essa altura será automaticamente rolável com a barra de scroll visível.

