

# Plano: Corrigir Barra de Rolagem no Diálogo de Associar Disciplina

## Problema Identificado

O componente `ScrollArea` do Radix UI não está exibindo a barra de rolagem corretamente. Isso ocorre porque o Radix UI ScrollArea requer uma altura fixa explícita para calcular corretamente a área de rolagem.

## Solução

Modificar a estrutura do `DialogContent` e `ScrollArea` para garantir que a barra de rolagem funcione corretamente:

1. Usar uma altura fixa no `ScrollArea` em vez de `calc()`
2. Garantir que o layout flex do DialogContent esteja configurado corretamente

---

## Alterações

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**Linha 265 - DialogContent:**
- Manter `overflow-hidden flex flex-col`

**Linha 288 - ScrollArea:**
- Alterar de `h-[calc(85vh-200px)]` para uma altura fixa como `h-[400px]` ou `h-[50vh]`
- Adicionar `min-h-0` para permitir que o flexbox funcione corretamente

---

## Código Final

```typescript
<DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
  <DialogHeader className="flex-shrink-0">
    {/* ... header content ... */}
  </DialogHeader>

  <ScrollArea className="flex-1 min-h-0 h-[400px] pr-4">
    {/* ... content ... */}
  </ScrollArea>

  <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
    {/* ... buttons ... */}
  </DialogFooter>
</DialogContent>
```

---

## Por Que Isso Funciona

| Problema | Solução |
|----------|---------|
| `calc()` nem sempre é interpretado corretamente pelo Radix | Altura fixa explícita |
| Flexbox pode interferir no cálculo de altura | `min-h-0` permite compressão |
| Header/Footer podem não ter `flex-shrink-0` | Adicionar classe ao header |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/mapping/TeacherAssociationDialog.tsx` | Ajustar classes do ScrollArea e DialogHeader |

