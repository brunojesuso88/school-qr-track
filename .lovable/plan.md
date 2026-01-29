

# Plano: Corrigir Dialog Fechando ao Trocar de Aba (Solucao Robusta)

## Problema Identificado

A solucao anterior com `onFocusOutside` nao esta funcionando. Apos investigacao mais detalhada, identifiquei que o Radix UI Dialog tem multiplos mecanismos que podem causar o fechamento:

1. `onFocusOutside` - quando o foco sai do dialogo
2. `onPointerDownOutside` - quando clica fora
3. `onInteractOutside` - combinacao dos dois anteriores
4. O proprio `onOpenChange` que pode ser chamado internamente

---

## Solucao

Aplicar uma abordagem de multiplas camadas para garantir que o dialogo nao feche ao trocar de aba:

### Alteracao 1: Usar `onInteractOutside` combinado com `onPointerDownOutside`

Em vez de apenas `onFocusOutside`, usar `onInteractOutside` que captura TODOS os eventos de interacao externa, mas de forma inteligente - permitindo que o clique no overlay ainda funcione.

### Alteracao 2: Controlar o `onOpenChange` de forma mais inteligente

Modificar o `onOpenChange` para aceitar o valor booleano e so fechar quando realmente deve fechar (quando o valor e `false` vindo de uma acao intencional do usuario).

---

## Arquivo: `src/pages/mapping/MappingDistribution.tsx`

### Antes (linhas 181-186):
```typescript
<Dialog open={!!selectedSubjectId} onOpenChange={() => setSelectedSubjectId(null)}>
  <DialogContent 
    className="max-w-md"
    onFocusOutside={(e) => e.preventDefault()}
  >
```

### Depois:
```typescript
<Dialog 
  open={!!selectedSubjectId} 
  onOpenChange={(open) => {
    if (!open) setSelectedSubjectId(null);
  }}
  modal={true}
>
  <DialogContent 
    className="max-w-md"
    onInteractOutside={(e) => {
      // Previne fechamento por eventos de focus (troca de aba)
      // Mas permite fechamento por clique no overlay
      const isPointerEvent = e.type === 'pointerdown' || e.type === 'pointerup';
      if (!isPointerEvent) {
        e.preventDefault();
      }
    }}
  >
```

---

## Como Funciona

| Evento | Comportamento |
|--------|---------------|
| Trocar de aba (focus outside) | Dialogo permanece aberto |
| Clicar no overlay | Dialogo fecha normalmente |
| Clicar no X | Dialogo fecha normalmente |
| Pressionar ESC | Dialogo fecha normalmente |
| Concluir atribuicao | Dialogo fecha normalmente |

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingDistribution.tsx` | Modificar Dialog e DialogContent com eventos mais robustos |

---

## Secao Tecnica

### Por que a solucao anterior nao funcionou

O `onFocusOutside` do Radix UI pode nao ser disparado corretamente em todos os navegadores/sistemas operacionais quando a janela do navegador perde o foco. Ao usar `onInteractOutside`, capturamos TODOS os eventos externos e podemos filtrar de forma mais precisa.

### Logica do `onInteractOutside`

O evento `onInteractOutside` pode ser de dois tipos:
- `FocusOutsideEvent` - quando o foco sai (troca de aba)
- `PointerDownOutsideEvent` - quando clica fora (overlay)

Verificando o `e.type`, podemos distinguir entre os dois e so bloquear eventos de foco, permitindo que cliques no overlay ainda fechem o dialogo.

### Alternativa se ainda nao funcionar

Se esta solucao ainda nao funcionar, podemos implementar um listener de `visibilitychange` no documento para controlar o estado do dialogo de forma completamente manual.

