

# Plano: Manter Dialog Aberto ao Trocar de Aba

## Problema Identificado

Quando você está com um diálogo aberto (como "Atribuir Professor" na Distribuição) e troca de aba no Windows, o diálogo fecha automaticamente. Isso acontece porque o componente Dialog do Radix UI detecta que o foco saiu do diálogo e o fecha.

---

## Solução

Adicionar as propriedades `onPointerDownOutside` e `onFocusOutside` no DialogContent para prevenir o fechamento automático apenas quando a ação vem de fora da janela (como trocar de aba).

---

## Alterações

### Arquivo: `src/pages/mapping/MappingDistribution.tsx`

**Antes**:
```typescript
<DialogContent className="max-w-md">
```

**Depois**:
```typescript
<DialogContent 
  className="max-w-md"
  onFocusOutside={(e) => e.preventDefault()}
>
```

---

## Como Funciona

| Propriedade | Função |
|-------------|--------|
| `onFocusOutside` | Chamada quando o foco sai do diálogo (incluindo troca de aba). Ao chamar `preventDefault()`, impedimos que o diálogo feche. |

O diálogo ainda fechará quando:
- Você clicar no X
- Você clicar no overlay escuro (fora do diálogo)
- Você pressionar ESC
- A atribuição for concluída com sucesso

---

## Arquivo Afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingDistribution.tsx` | Adicionar `onFocusOutside` no DialogContent |

---

## Seção Técnica

### Por que isso acontece

O Radix UI Dialog implementa "focus trapping" - mantém o foco dentro do diálogo enquanto está aberto. Quando a janela do navegador perde o foco (ao trocar de aba), o Dialog detecta isso como um evento de "focus outside" e fecha automaticamente.

### Solução técnica

Usando `onFocusOutside={(e) => e.preventDefault()}`, interceptamos esse evento e prevenimos o comportamento padrão de fechar o diálogo.

### Comportamento preservado

- Clicar fora do diálogo (no overlay) ainda fecha o diálogo
- O botão X ainda funciona
- A tecla ESC ainda funciona
- Concluir a atribuição ainda fecha o diálogo

