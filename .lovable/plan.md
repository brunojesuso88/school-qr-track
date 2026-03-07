

# Plano: 4 Alteracoes na Home, Rotas e Frequencia

## 1. Remover botao "QR Codes" da Home

**Arquivo**: `src/pages/Home.tsx`
- Remover o item `QR Codes` do array `menuOptions` (linhas 37-45)

## 2. Aumentar botao de configuracoes na Home

**Arquivo**: `src/pages/Home.tsx`
- Alterar o botao de engrenagem (linha 171-176) para ser maior: `h-16 w-16` e icone `h-8 w-8`

## 3. Professor acessa apenas Sistema de Gestao de Alunos (sem Home)

**Arquivo**: `src/components/AdminRoute.tsx`
- Adicionar verificacao: se `userRole === 'teacher'` e a rota atual e `/home`, redirecionar para `/dashboard`

**Arquivo**: `src/pages/Home.tsx`
- Nenhuma mudanca necessaria (professor simplesmente nao acessa a Home)

Dessa forma, professores ao tentar acessar `/home` serao redirecionados automaticamente para `/dashboard`. O `AdminRoute` que protege `/home` fara essa verificacao.

Na pratica, precisamos de uma abordagem diferente: o `AdminRoute` nao sabe a rota. Melhor criar logica no proprio componente Home ou usar um wrapper especifico.

**Abordagem**: No `src/pages/Home.tsx`, verificar no inicio se `userRole === 'teacher'` e redirecionar com `Navigate` para `/dashboard`.

Tambem no `SplashScreen` ou onde o login redireciona, garantir que professor va direto para `/dashboard` ao inves de `/home`.

## 4. Calendario de frequencia diaria + relatorio por dia

**Arquivo**: `src/pages/Attendance.tsx`
- Adicionar uma nova secao com um componente `Calendar` (shadcn) que mostra o mes atual
- Ao selecionar um dia no calendario, exibir a frequencia de todas as turmas naquele dia
- Marcar visualmente no calendario os dias que tem registros de frequencia (dots ou cores)
- Adicionar botao "Gerar Relatorio" que gera PDF da frequencia do dia selecionado, mostrando por turma: lista de alunos com status presente/ausente

Logica:
1. Buscar datas com registros no mes: `SELECT DISTINCT date FROM attendance WHERE date BETWEEN start AND end`
2. Ao clicar em um dia, buscar attendance daquele dia com dados dos alunos
3. Agrupar por turma e exibir em tabela
4. Botao para gerar relatorio HTML/PDF do dia

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Home.tsx` | Remover QR Codes, aumentar botao config, redirecionar professor |
| `src/pages/Attendance.tsx` | Adicionar calendario com frequencia diaria e geracao de relatorio por dia |

