

# Plano: Corrigir Barra de Rolagem no Diálogo de Associar Disciplina

## Problema Identificado

O `DialogContent` do Radix UI usa `grid` como display base, e ao sobrescrever com `flex flex-col`, há um conflito de layout. O componente `ScrollArea` do Radix UI requer uma altura explícita e um container bem definido para funcionar corretamente.

## Causa Raiz

1. **Conflito de Layout**: O CSS base do DialogContent tem `grid` (linha 39 do dialog.tsx), mas estamos aplicando `flex flex-col` por cima
2. **Viewport do ScrollArea**: O Radix ScrollArea cria um `Viewport` interno que precisa herdar altura corretamente
3. **Altura não propagada**: Mesmo com `h-[400px]`, o flex container pode não estar propagando a altura corretamente

## Solução

Usar uma abordagem mais robusta com um container wrapper que garante a altura fixa do ScrollArea:

---

## Alterações

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**1. Simplificar o DialogContent (linha 265)**

Remover `overflow-hidden flex flex-col` e usar uma estrutura mais simples com altura máxima.

**2. Envolver o ScrollArea em um div com altura fixa (linha 288)**

Criar um wrapper `div` com altura fixa que contenha o ScrollArea.

**3. Mover o DialogFooter para fora do fluxo do scroll**

Garantir que o footer sempre esteja visível.

---

## Código Final

```tsx
return (
  <Dialog open={!!teacher} onOpenChange={() => handleClose()}>
    <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
      <DialogHeader className="flex-shrink-0 pb-2">
        <DialogTitle className="flex items-center gap-2">
          <Book className="h-5 w-5" />
          Associar disciplinas
        </DialogTitle>
        <div className="flex items-center gap-2 pt-1">
          {/* ... header content ... */}
        </div>
      </DialogHeader>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full max-h-[50vh] pr-4">
          {/* ... scroll content ... */}
        </ScrollArea>
      </div>

      <DialogFooter className="flex-shrink-0 pt-4 gap-2 sm:gap-0 border-t mt-2">
        {/* ... buttons ... */}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

---

## Explicação Técnica

| Problema | Solução |
|----------|---------|
| `grid` vs `flex` conflito | Usar `flex flex-col` com `!important` via Tailwind ou estrutura mais explícita |
| ScrollArea sem altura definida | Wrapper `div` com `flex-1 min-h-0 overflow-hidden` + ScrollArea com `h-full max-h-[50vh]` |
| Footer cortado | `flex-shrink-0` + `pt-4` + `border-t` para separação visual |
| Viewport interno do ScrollArea | `h-full` permite que o viewport herde a altura do container |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/mapping/TeacherAssociationDialog.tsx` | Reestruturar layout do diálogo com wrapper para ScrollArea |

