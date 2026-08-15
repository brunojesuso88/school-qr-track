# IRA multi-período: plano técnico

## Estado atual verificado (consultas ao banco, agosto/2026)

- 22 turmas cadastradas, **1** com boletim importado (`grade_subjects`), **1** linha em `ira_settings`.
- **6.480** notas em `student_grades` — acima do limite padrão de 1.000 linhas por requisição do backend, o que trunca silenciosamente a busca de notas em lote (causa confirmada do IRA "—" nos cards).
- Nenhum aluno com `students.class` sem turma correspondente em `classes` (o vínculo por nome está íntegro hoje, mas é frágil).
- A coluna `ira_period_ids uuid[]` já existe em `ira_settings` e a configuração antiga (`ira_period_id`) já foi convertida para o formato de lista.

## Escopo

### 1. Configurações → IRA por turma, com visão de todas as turmas
- Seletor lista **todas** as 22 turmas, cada uma com status: "sem boletim", "IRA não configurado" ou configurada.
- Resumo textual: total de turmas, quantas têm boletim, quantas têm IRA configurado.
- Configuração continua **efetiva por turma** (uma linha por turma em `ira_settings`).
- Ação "Aplicar a todas as turmas": replica a seleção atual para todas as turmas com boletim, casando os períodos pelo rótulo normalizado (ex.: "1º Período"); turmas sem período equivalente são ignoradas e reportadas.

### 2. Múltiplos períodos
- Seleção por caixas de marcação (vários bimestres) e "Nota Final" como alternativa **exclusiva** (ao marcar Nota Final, a seleção de bimestres é limpa e desabilitada).
- Regra de cálculo: para cada disciplina selecionada, média aritmética das notas dos períodos escolhidos, com nota ausente valendo 0,00 **apenas no cálculo**; depois média ponderada entre disciplinas com pesos 1/2/4 ou peso personalizado.
- Persistência: `ira_period_ids` (lista) + `ira_period_id` preenchido com o primeiro item, mantendo compatibilidade com leituras antigas.
- Leitura com precedência: Nota Final → `ira_period_ids` → `ira_period_id` (legado).

### 3. Correção do IRA no card (Students)
- Card e detalhe do aluno passam a chamar exatamente a mesma função de cálculo.
- Busca de notas paginada (blocos de 1.000) para eliminar o truncamento; filtro por aluno aplicado na consulta apenas quando a lista é curta, e em memória quando é longa (evita URL gigante).
- Vínculo aluno→turma por nome exato com alternativa por nome normalizado; nomes duplicados e turmas inexistentes são registrados no console e devolvidos pelo hook em vez de resultar em IRA vazio.
- Erros de consulta deixam de ser engolidos: o hook expõe estado de erro.
- Custo mantido em poucas consultas por lista (turmas, disciplinas, períodos, configuração, notas paginadas), independente da quantidade de alunos.

### 4. Motor único
- Todo o cálculo multi-período fica em `src/lib/ira.ts`; hooks e telas apenas montam entradas e exibem resultados.

### 5. "—" com motivo
- O card mostra "—" apenas quando não há configuração de períodos, nenhuma disciplina marcada ou nenhuma disciplina com peso válido; o tooltip traz o motivo exato.

### 6. Banco
- `ira_settings.ira_period_ids uuid[]` (já aplicada) e tipos regenerados.

## Arquivos e tabelas

| Arquivo / tabela | Mudança |
| --- | --- |
| `src/lib/ira.ts` | Motor único multi-período: média por disciplina, ponderação, motivos, períodos selecionados |
| `src/hooks/useStudentGrades.ts` | Resolução de períodos, montagem de entradas por período, busca paginada de notas |
| `src/hooks/useStudentsIra.ts` | Cálculo em lote reutilizando o motor único; paginação; vínculo de turma resiliente; estado de erro |
| `src/components/grades/StudentGradesTab.tsx` | Marca as colunas usadas no IRA e exibe a base do cálculo |
| `src/components/grades/IRABreakdown.tsx` | Composição com nota de cada período, nota usada, peso e contribuição |
| `src/components/settings/IRASettings.tsx` | Todas as turmas com status, seleção múltipla, Nota Final exclusiva, aplicar a todas |
| `public.ira_settings` | `ira_period_ids uuid[]`, com dados antigos migrados |

## Riscos

- **Vínculo por nome de turma**: `students.class` é texto; renomear turma ou nomes duplicados quebram o cálculo. Mitigação: correspondência normalizada e alerta explícito (vínculo por id fica como evolução futura).
- **"Aplicar a todas as turmas"**: sobrescreve configuração existente das turmas com boletim. Mitigação: casamento por rótulo, relatório de turmas ignoradas e mensagem de confirmação.
- **Nota ausente = 0,00**: pode derrubar o IRA de turmas com lançamento incompleto. Mitigação: aviso no card, no detalhe e na composição, com contagem de disciplinas afetadas.
- **Volume de notas**: turmas grandes com muitos períodos aumentam o número de páginas buscadas. Mitigação: uma consulta paginada por lista, não por aluno.
- **Compatibilidade**: telas antigas que leiam `ira_period_id` continuam funcionando porque o primeiro período é gravado nele.

## Estratégia de teste

1. **Consistência card × detalhe**: para a turma com boletim, comparar o IRA do card com o da aba Notas de vários alunos — devem ser idênticos.
2. **Truncamento**: com 6.480 notas, confirmar que todos os alunos da turma recebem IRA (nenhum "—" indevido).
3. **Multi-período**: selecionar 1º e 2º períodos e conferir manualmente uma disciplina (média dos dois períodos × peso) contra a composição exibida.
4. **Nota ausente**: aluno com nota faltando em um período selecionado deve entrar com 0,00 no cálculo e continuar com "—" na aba Notas.
5. **Exclusividade**: marcar Nota Final limpa e desabilita os bimestres; desmarcar volta a permitir a seleção múltipla.
6. **Motivos do "—"**: turma sem configuração, turma sem disciplina marcada e disciplina com carga fora de 1/2/4 sem peso personalizado devem produzir tooltips distintos e corretos.
7. **Aplicar a todas as turmas**: confirmar quantas turmas foram configuradas e que turmas sem períodos equivalentes foram apenas reportadas.
8. **Regressão de pesos**: cargas 1/2/4 continuam automáticas; carga 3 exige peso personalizado para participar.

## Observação

As alterações descritas acima já foram implementadas na etapa anterior desta conversa, incluindo a migração de `ira_period_ids`. Ao aprovar este plano, a próxima etapa é a execução da bateria de testes acima e o ajuste dos pontos que ela revelar.
