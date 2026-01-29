

# Plano: Corrigir Barra de Rolagem no Diálogo de Distribuição

## Problema

O `ScrollArea` na linha 245 do `MappingDistribution.tsx` tem `flex-1` junto com a altura fixa:

```tsx
<ScrollArea className="flex-1 h-[calc(70vh-120px)] pr-4">
```

O `flex-1` pode interferir no cálculo da altura do Radix UI ScrollArea. A solução é remover `flex-1` e manter apenas a altura fixa explícita, como foi feito anteriormente no `TeacherAssociationDialog`.

---

## Alteração

### Arquivo: `src/pages/mapping/MappingDistribution.tsx`

**Linha 245 - Substituir:**

```tsx
<ScrollArea className="flex-1 h-[calc(70vh-120px)] pr-4">
```

**Por:**

```tsx
<ScrollArea className="h-[calc(85vh-200px)] pr-4">
```

Onde:
- Remove `flex-1` que pode conflitar com a altura
- Usa o mesmo cálculo do `TeacherAssociationDialog` para consistência

---

## Resumo

| Antes | Depois |
|-------|--------|
| `flex-1 h-[calc(70vh-120px)]` | `h-[calc(85vh-200px)]` |

---

## Seção Técnica

A documentação do projeto especifica que o Radix UI ScrollArea requer altura fixa explícita. O `flex-1` interfere porque tenta crescer/encolher com base no container flex, não respeitando a altura calculada.

