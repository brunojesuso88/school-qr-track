# Corrigir botão Editar no histórico

## Problema
Em `src/pages/TeacherNotifications.tsx`, o componente `Tabs` é **não-controlado** (`defaultValue="new"`). Ao clicar em "Editar" na aba **Histórico**, a função `loadRecord` preenche o formulário corretamente e exibe o toast "Editando XXXX/YYYY", mas a aba ativa permanece em **Histórico** — então o usuário não vê o formulário sendo carregado e parece que o botão "não funciona".

## Correção
Tornar o `Tabs` controlado e mudar para a aba `new` automaticamente quando o usuário clicar em "Editar".

### Alterações em `src/pages/TeacherNotifications.tsx`
1. Adicionar estado `const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');`
2. Trocar `<Tabs defaultValue="new">` por `<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>`
3. Em `loadRecord`, adicionar `setActiveTab('new');` antes do `window.scrollTo(...)` para que o formulário fique visível imediatamente após clicar em "Editar".
4. (Opcional) Em `resetForm`/cancelar edição, manter o usuário na aba atual — sem mudança adicional necessária.

Nenhuma mudança de backend, schema ou lógica de negócios.
