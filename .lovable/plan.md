## 1. Home: renomear título

- `src/pages/Home.tsx`: alterar "Sistema de Gestão de Alunos" para "Sistema de Gestão" no card principal.

## 2. Cards de Projetos e Eventos: link de compartilhamento

Adicionar um botão "Compartilhar link" (ícone `Link2` / `Share2`) nos cards:

- `src/components/events/EventCard.tsx` (Projetos)
- `src/components/school-events/SchoolEventCard.tsx` (Eventos)

Comportamento: copia para a área de transferência uma URL pública contendo o ID do projeto/evento (`/events?id=<id>` e `/school-events?id=<id>`). Mostra toast "Link copiado".

Nas páginas `Events.tsx` e `SchoolEvents.tsx`: ler `?id=` na URL no `useEffect` e abrir automaticamente o `DetailDialog` correspondente, permitindo que qualquer pessoa com acesso ao sistema veja diretamente aquele projeto/evento ao abrir o link.

> Observação: os dados continuam protegidos por RLS (apenas usuários autenticados com role válido conseguem ver). O link é um deep-link interno, não acesso público anônimo. Caso seja necessário acesso totalmente público sem login, será preciso uma decisão separada (criar tabela/endpoint público), confirmar antes de implementar.

## 3. Turmas: resumo de presença ao clicar no card

Hoje, clicar no card só amplia a foto. Vou substituir por um **modal de resumo da turma**:

- Novo componente `src/components/ClassSummaryDialog.tsx`.
- Ao clicar no card, abrir o modal com:
  - Cabeçalho: foto, nome, turno, total de alunos.
  - **Resumo geral da turma**: % de presença geral (últimos 30 dias), nº de aulas registradas, total de presenças/faltas/atrasos.
  - **Resumo por aluno** (tabela rolável): nome, total de presenças, faltas, atrasos, % de presença. Ordenável por % de presença (pior → melhor).
  - Botão "Ver detalhes do aluno" abre `StudentReportModal` existente.
- Consulta: `attendance` filtrado por `students.class = <turma>` agregado em memória; a foto continua sendo zoomada por um botão separado dentro do modal.

## 4. Turmas: importação PDF inteligente (reconciliação)

Substituir a lógica atual de "apenas inserir" por uma reconciliação completa entre PDF e alunos existentes da turma.

Fluxo no `Classes.tsx` após `parse-students-pdf` retornar:

1. Buscar alunos atuais da turma (`students` onde `class = importingClass.name` e `status = 'active'`).
2. Normalizar nomes (trim, lowercase, remover acentos) e comparar:
   - **MANTER** (verde): nome existe nos dois → não alterar.
   - **ADICIONAR** (azul): nome só no PDF → criar novo aluno.
   - **REMOVER** (vermelho, tachado): nome só no banco → marcar para exclusão (soft via `status = 'inactive'` para preservar histórico de presenças).
3. Mostrar tabela de revisão com 3 seções/colunas de status, checkbox por linha (todos pré-selecionados), permitindo o usuário desmarcar exclusões/adições antes de confirmar.
4. Botão "Aplicar alterações" executa em paralelo: `insert` dos novos + `update status='inactive'` dos removidos. Toast resume: "X adicionados, Y removidos, Z mantidos".

> Decisão de soft-delete: alunos com presenças históricas não podem ser apagados sem perder dados de frequência. Marcar como `inactive` mantém histórico e os remove das listas ativas. Confirmar se prefere hard delete.

### Arquivos a editar
- `src/pages/Home.tsx`
- `src/components/events/EventCard.tsx`, `src/pages/Events.tsx`
- `src/components/school-events/SchoolEventCard.tsx`, `src/pages/SchoolEvents.tsx`
- `src/pages/Classes.tsx`
- Novo: `src/components/ClassSummaryDialog.tsx`

### Sem mudanças de DB
Nenhuma migração necessária — uso de `status='inactive'` já existe na tabela `students`.
