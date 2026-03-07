

# Auditoria: Pagina Nao Carrega ao Acessar

## Causa Raiz Identificada

O problema esta no **SplashScreen.tsx** (rota `/`). Quando o usuario acessa a pagina, o fluxo e:

1. SplashScreen espera 2 segundos (splash animation)
2. Apos 2s, verifica `loading` e `userRole`
3. **BUG**: Se `userRole === null`, navega para `/dashboard` — independente de o usuario estar logado ou nao

Isso causa dois problemas:

**Problema 1 — Cadeia de redirecionamentos desnecessaria:**
```text
/ (SplashScreen) → /dashboard (AdminRoute) → /auth
```
Em vez de ir direto para `/auth`, o usuario passa por 2 redirecionamentos, causando atraso e possivel tela branca.

**Problema 2 — Race condition com token invalido:**
Os logs de autenticacao mostram `"Refresh Token Not Found"` (token expirado). Quando o Supabase tenta renovar o token e falha, `getSession()` e `onAuthStateChange` podem competir: um seta `loading=false`, o outro seta `loading=true` novamente. Se `loading` ficar `true` indefinidamente, o SplashScreen fica preso na animacao para sempre.

**Problema 3 — Home.tsx tambem redireciona userRole null:**
Linha 16 de Home.tsx: `if (userRole === null) return <Navigate to="/dashboard" replace />`. Mesmo que o usuario logado chegue a Home sem role carregada, e redirecionado, criando outro bounce.

## Solucao

### 1. SplashScreen.tsx — Verificar `user` antes de redirecionar

```typescript
useEffect(() => {
  if (!showSplash && !loading) {
    if (!user) {
      navigate("/auth");  // Sem usuario → login direto
      return;
    }
    // Usuario logado → rota baseada na role
    if (userRole === 'admin' || userRole === 'direction') {
      navigate("/home");
    } else {
      navigate("/dashboard");
    }
  }
}, [showSplash, loading, user, userRole, navigate]);
```

### 2. AuthContext.tsx — Proteger contra race condition

Adicionar flag `initialLoadDone` para garantir que `onAuthStateChange` nao resete `loading=true` durante o carregamento inicial, evitando loop infinito:

```typescript
const [initialLoadDone, setInitialLoadDone] = useState(false);

// No getSession callback:
setInitialLoadDone(true);

// No onAuthStateChange:
if (session?.user) {
  if (initialLoadDone) setLoading(true); // So reseta se ja carregou uma vez
  // ...
}
```

### 3. Home.tsx — Nao redirecionar quando role ainda nao carregou

Verificar `loading` antes de fazer redirect por `userRole === null`, para nao redirecionar prematuramente enquanto a role esta sendo buscada.

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/SplashScreen.tsx` | Verificar `user` antes de redirecionar; sem usuario → /auth |
| `src/contexts/AuthContext.tsx` | Flag para evitar race condition no loading |
| `src/pages/Home.tsx` | Nao redirecionar userRole null prematuramente |

