

# Plano: Corrigir Formulário de Novo Professor

## Problemas Identificados

1. **ScrollArea não funciona**: O `flex-1` no ScrollArea não funciona sem altura explícita no container
2. **Botões invisíveis**: Os botões "Cancelar" e "Cadastrar" estão dentro do ScrollArea e ficam escondidos quando o conteúdo é maior que a tela

---

## Solução

### 1. Corrigir Layout do DialogContent

**Arquivo**: `src/pages/mapping/MappingTeachers.tsx`

**Problema**: O `ScrollArea` com `flex-1` precisa de altura definida no container pai.

**Alteração**:
- Adicionar `overflow-hidden` ao DialogContent
- Usar altura fixa no ScrollArea ao invés de `flex-1`

**De**:
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

**Para**:
```typescript
<DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  <ScrollArea className="h-[calc(90vh-120px)] pr-4">
    <TeacherForm ... />
  </ScrollArea>
</DialogContent>
```

### 2. Mover Botões para Fora do ScrollArea

**Arquivo**: `src/components/mapping/TeacherForm.tsx`

**Problema**: Os botões estão dentro do form que está dentro do ScrollArea, então eles rolam e ficam invisíveis.

**Solução**: Separar os botões do conteúdo rolável. Para isso, o TeacherForm precisa aceitar uma prop para renderizar os botões externamente, OU manter os botões sempre visíveis com posição fixa.

**Opção escolhida**: Manter os botões dentro do formulário mas garantir que eles fiquem visíveis usando `sticky bottom-0`:

```typescript
<div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
  <Button type="button" variant="outline" onClick={onClose}>
    Cancelar
  </Button>
  <Button type="submit" disabled={loading}>
    {loading ? "Salvando..." : teacher ? "Salvar" : "Cadastrar"}
  </Button>
</div>
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingTeachers.tsx` | Corrigir altura do ScrollArea |
| `src/components/mapping/TeacherForm.tsx` | Adicionar sticky aos botões |

---

## Seção Técnica

### Detalhes da Correção do ScrollArea

O componente `ScrollArea` do Radix UI requer que seu container tenha uma altura definida para funcionar corretamente. Usando `h-[calc(90vh-120px)]`:
- `90vh` = altura máxima do dialog
- `120px` = espaço para header (~60px) + padding (~60px)

### Detalhes do Sticky

O `sticky bottom-0` mantém os botões fixos no fundo da área de scroll, garantindo que sempre fiquem visíveis. O `bg-background` garante que o fundo tenha a cor correta e não fique transparente.

