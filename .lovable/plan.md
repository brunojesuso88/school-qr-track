

# Plano: Chamada Diaria por Turma

## Objetivo

Ao clicar no card de uma turma, abrir um dialog mostrando todos os alunos da turma com a data do dia, permitindo registrar presenca em lote (presente/ausente por aluno). Por padrao todos marcados como presente. Salvar somente ao clicar no botao "Salvar".

## Alteracoes

### 1. Novo componente: `src/components/ClassAttendanceDialog.tsx`

Dialog que recebe o nome da turma e exibe:
- Header com nome da turma e data atual (formato brasileiro)
- Lista de todos os alunos ativos da turma
- Para cada aluno: nome + dois botoes (Presente verde / Ausente vermelho)
- Por padrao, todos marcados como "present"
- Botao "Salvar" no final que faz upsert em batch na tabela `attendance`

Logica do save:
- Para cada aluno, verificar se ja existe registro no dia (`attendance` com `student_id` + `date`)
- Se existe, atualizar o status
- Se nao existe, inserir novo registro
- Tudo em uma unica operacao batch
- Chamar `onSuccess` callback apos salvar

### 2. `src/pages/Classes.tsx`

- Adicionar estado para controlar o dialog de chamada (`attendanceClass` / `isAttendanceOpen`)
- Tornar o card da turma clicavel (onClick no Card) para abrir o dialog de chamada
- Importar e renderizar o novo `ClassAttendanceDialog`

## Fluxo do usuario

1. Clica no card da turma
2. Dialog abre com todos os alunos, data do dia, todos marcados como "Presente" (verde)
3. Clica em "Ausente" (vermelho) nos alunos faltantes
4. Clica em "Salvar" - sistema grava tudo de uma vez
5. Toast de sucesso e dialog fecha

