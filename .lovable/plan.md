

# Auditoria: Redirecionamento de Novos Usuarios

## Causa Raiz

O problema esta em **`src/pages/Auth.tsx` linha 49**: apos login ou cadastro, o `useEffect` redireciona **todos** os usuarios para `/home`, independentemente da role:

```typescript
useEffect(() => {
  if (user) {
    navigate('/home'); // ← SEMPRE vai para /home
  }
}, [user, navigate]);
```

Home.tsx tem a verificacao `if (userRole === null) return <Navigate to="/dashboard" />`, mas ha uma **condicao de corrida**: quando o `user` e setado, o `userRole` ainda pode estar sendo carregado. O usuario ve brevemente a tela Home antes do redirect acontecer, mostrando os cards (possivelmente uma versao em cache com QR Codes).

## Solucao

**`src/pages/Auth.tsx`**: Alterar o useEffect para considerar `loading` e `userRole` antes de redirecionar:

```typescript
const { signIn, signUp, user, loading, userRole } = useAuth();

useEffect(() => {
  if (user && !loading) {
    if (userRole === 'admin' || userRole === 'direction') {
      navigate('/home');
    } else {
      navigate('/dashboard'); // teacher, staff, null (novo usuario)
    }
  }
}, [user, loading, userRole, navigate]);
```

Isso garante que:
- O redirecionamento so ocorre apos a role ser carregada
- Novos usuarios (role null) e professores vao direto para `/dashboard`
- Apenas admin e direcao veem a tela Home
- Elimina o flash da Home para usuarios nao autorizados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Auth.tsx` | Redirecionar baseado na role apos loading |

