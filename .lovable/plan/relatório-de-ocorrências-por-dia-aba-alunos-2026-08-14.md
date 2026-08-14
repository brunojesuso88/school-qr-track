## Relatório de Ocorrências por dia (aba Alunos)

Novo botão **"Relatório de Ocorrências"** no topo da página Alunos. O usuário escolhe uma data no calendário e o sistema gera um PDF com todas as ocorrências daquele dia, agrupadas por turma, mostrando o professor que registrou.

### Fluxo
1. Clique no botão abre um diálogo com calendário (mesmo padrão já usado nos formulários de ocorrência).
2. Ao confirmar, o sistema busca as ocorrências da data escolhida junto com os dados do aluno (nome, matrícula, turma, turno).
3. Se não houver registros no dia, aparece um aviso e nenhum PDF é gerado.
4. Havendo registros, o PDF é baixado automaticamente com nome como `ocorrencias_2026-08-14.pdf`.

### Conteúdo do PDF
- Cabeçalho: nome da escola, título "Relatório de Ocorrências", data escolhida (dd/MM/aaaa) e total de ocorrências.
- Uma seção por turma (ordem alfabética), com o turno ao lado do nome da turma.
- Tabela por turma com colunas: Aluno, Matrícula, Tipo de ocorrência, Registrado por (professor), Descrição.
- Ocorrências de atestado médico mostram o período (data inicial a data final).
- Rodapé com paginação e data/hora de emissão.

### Detalhes técnicos
- `src/pages/Students.tsx`: botão + estado do diálogo; novo componente `src/components/OccurrencesReportDialog.tsx` com o calendário e a geração.
- Consulta: `occurrences` filtrando `date` igual à data selecionada, com join em `students` (`full_name, student_id, class, shift`); ocorrências de atestado que abrangem a data também podem ser incluídas via `end_date >= data`.
- PDF gerado com `jsPDF` + `jspdf-autotable` (já usados em `MappingSummary.tsx`), agrupando por `class` e usando `teacher_name` na coluna "Registrado por".
- Nome da escola vindo do hook existente `useSchoolName`.

Sem mudanças de banco de dados ou de permissões.
