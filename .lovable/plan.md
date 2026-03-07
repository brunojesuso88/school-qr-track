

# Plano: 5 Alteracoes (Home, Alunos, Frequencia)

## 1. QR Codes e redirecionamento de novos usuarios

**Problema**: O item "QR Codes" ja foi removido do `menuOptions` em Home.tsx, mas existe "Escanear QR" no sidebar do `DashboardLayout.tsx` (linha 24) visivel para professores. Alem disso, novos usuarios (`userRole === null`) sao barrados pelo `AdminRoute` e redirecionados para `/auth`.

**Solucoes**:
- `src/pages/Home.tsx`: Adicionar redirecionamento para usuarios sem role (`userRole === null` apos loading) para `/dashboard`
- `src/pages/SplashScreen.tsx`: Usuarios sem role definida → redirecionar para `/dashboard` (nao para `/home`)
- `src/contexts/AuthContext.tsx`: Incluir `userRole === null` (novos usuarios) como `isDashboardUser` para permitir acesso ao sistema
- `src/components/DashboardLayout.tsx`: Remover "Escanear QR" do array de navegacao (ou esconder para professores, conforme necessario)

## 2. Mover configuracoes da Home para o DashboardLayout

**Problema**: Botao de engrenagem na Home e dificil de clicar no mobile (posicao `absolute top-4 right-4`). O botao fica sobreposto ou fora da area de toque natural.

**Solucao**:
- Remover todo o bloco de configuracoes (Sheet, dialogs de senha/exclusao/about) de `Home.tsx`
- Mover a logica de configuracoes para dentro do `DashboardLayout.tsx`, adicionando um botao de engrenagem no header/toolbar do layout ou no dropdown do usuario (que ja tem signOut)
- No dropdown do usuario no DashboardLayout, adicionar: Alterar Senha, Forcar Atualizacao, Tema, Sobre o Sistema, Excluir Conta
- Isso resolve o problema mobile pois o botao ficara integrado ao layout padrao do sistema

## 3. Remover data de nascimento e gerar ID com nome+turma+turno

**Arquivo**: `src/pages/Students.tsx`

- Remover o campo "Data de Nascimento" (dia/mes/ano selects) do formulario
- Remover estados `birthDay`, `birthMonth`, `birthYear` e funcao `getBirthDate`
- Alterar `generateStudentId` para usar `fullName + class + shift`:
  ```typescript
  const generateStudentId = (fullName: string, className: string, shift: string): string => {
    if (!fullName || !className) return '';
    const initials = fullName.trim().split(' ').filter(p => p.length > 0).map(p => p[0].toUpperCase()).join('');
    const shiftCode = shift === 'morning' ? 'M' : shift === 'afternoon' ? 'T' : 'N';
    return `${initials}-${className}-${shiftCode}`;
  };
  ```
- Remover validacao de `birthDate` obrigatoria no `handleSubmit`
- Nao enviar `birth_date` no insert/update (campo continua na tabela mas fica null)

## 4. Tendencia de frequencia padrao "Ultima Semana"

**Arquivo**: `src/pages/Attendance.tsx`

- Linha 65: Alterar `useState<TrendPeriod>('6months')` para `useState<TrendPeriod>('week')`

## 5. Reorganizar pagina de Frequencia: calendario no topo

**Arquivo**: `src/pages/Attendance.tsx`

Nova ordem dos elementos no JSX (dentro do `<div className="space-y-6">`):
1. Header + botao de registro manual
2. **Calendario de Frequencia Diaria** (movido do final para ca)
3. Filtros ativos (banner)
4. Filtros (mes, turma, turno, status, aluno)
5. Cards de resumo (alunos, presencas, faltas, %)
6. Grafico de tendencia
7. Botoes de exportacao
8. Tabela de frequencia por aluno
9. Registros individuais

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Home.tsx` | Remover configuracoes, redirecionar usuarios sem role |
| `src/pages/SplashScreen.tsx` | Redirecionar novos usuarios para /dashboard |
| `src/contexts/AuthContext.tsx` | Permitir acesso ao dashboard para usuarios sem role |
| `src/components/DashboardLayout.tsx` | Adicionar painel de configuracoes no layout, remover QR |
| `src/pages/Students.tsx` | Remover data nascimento, gerar ID com nome+turma+turno |
| `src/pages/Attendance.tsx` | Default trend=week, calendario no topo, reorganizar layout |

