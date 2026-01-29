

# Plano: Desabilitar Refresh Automatico ao Trocar de Aba

## Problema Identificado

O sistema esta atualizando a pagina automaticamente quando voce troca de aba no Windows e depois volta. Isso acontece devido a configuracao padrao do React Query que refaz as consultas quando a janela ganha foco novamente.

---

## Solucao

Desabilitar o comportamento de refetch automatico no React Query quando a janela ganha foco.

### Alteracao

**Arquivo**: `src/App.tsx`

Configurar o QueryClient com opcoes que desabilitam o refetch automatico:

**De**:
```typescript
const queryClient = new QueryClient();
```

**Para**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
```

---

## O Que Cada Opcao Faz

| Opcao | Padrao | Nova Config | Efeito |
|-------|--------|-------------|--------|
| `refetchOnWindowFocus` | `true` | `false` | Nao refaz queries ao voltar para a aba |
| `refetchOnReconnect` | `true` | `false` | Nao refaz queries ao reconectar internet |

---

## Arquivo Afetado

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Configurar QueryClient para desabilitar refetch automatico |

---

## Secao Tecnica

### Por que isso acontece

O React Query, por padrao, assume que quando o usuario volta para a aba do navegador, os dados podem estar desatualizados. Por isso, ele automaticamente refaz todas as queries ativas para garantir que o usuario veja dados frescos.

### Beneficios da mudanca

- A pagina nao vai mais "piscar" ou recarregar ao trocar de abas
- Melhor experiencia do usuario ao trabalhar com multiplas abas
- Os dados ainda podem ser atualizados manualmente ou apos operacoes CRUD

### Alternativa

Se no futuro voce quiser manter os dados atualizados automaticamente sem o comportamento de "piscar", podemos implementar Realtime do banco de dados, que atualiza os dados silenciosamente em segundo plano apenas quando ha mudancas reais.

