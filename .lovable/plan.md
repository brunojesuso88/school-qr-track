

# Plano: Corrigir Barra de Rolagem com Altura Fixa

## Problema

O componente `ScrollArea` do Radix UI requer uma **altura fixa explícita** para funcionar corretamente. O código atual usa `h-full max-h-[50vh]` que não resolve o problema porque:

1. `h-full` herda de um container flex sem altura definida
2. `max-h` (altura máxima) não é interpretado como altura real pelo Radix ScrollArea

## Solução

Usar uma altura fixa calculada com `calc()` que considera o espaço disponível no diálogo.

---

## Alteração

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**Linha 288-289 - Substituir:**

```tsx
<div className="flex-1 min-h-0 overflow-hidden">
  <ScrollArea className="h-full max-h-[50vh] pr-4">
```

**Por:**

```tsx
<ScrollArea className="h-[calc(85vh-200px)] pr-4">
```

Onde:
- `85vh` = altura máxima do diálogo
- `200px` = espaço aproximado para header (~80px) + footer (~80px) + margens (~40px)

Também remover o wrapper `div` que não é mais necessário.

---

## Resumo das Mudanças

| Antes | Depois |
|-------|--------|
| `h-full max-h-[50vh]` | `h-[calc(85vh-200px)]` |
| Wrapper div com flex-1 | Sem wrapper (direto no ScrollArea) |

---

## Seção Técnica

A documentação de memória do projeto especifica:

> "Radix UI ScrollArea components require an explicit, fixed height (e.g., `h-[300px]` or `h-[calc(90vh-120px)]`) rather than a maximum height (`max-h`) to correctly calculate the scrollable area and display scrollbars."

O cálculo `calc(85vh-200px)` garante que o ScrollArea tenha uma altura fixa baseada no viewport, permitindo que o Radix calcule corretamente quando mostrar a barra de rolagem.

