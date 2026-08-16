# Auditoria: "aluno não identificado na turma" na importação de boletim

## Causa raiz (confirmada em dados reais)

O diálogo de importação carrega os alunos da turma **pelo NOME da turma vindo da prop `classItem`**, e essa prop fica **desatualizada depois que a turma é renomeada dentro do próprio diálogo** (opção "usar o nome da turma do PDF"). Resultado: a consulta volta **zero alunos**, o contexto de matching vai vazio e **todas as páginas** caem em "aluno não identificado na turma".

Evidência em banco (turma MM300CNS -> 26RMM-CNS-300, hoje):

```text
13:45:59  sessao de importacao da turma 877d042c...  -> contexto com 44 alunos (nome antigo ainda valido)
13:46:41  audit_logs: 40+ alunos com class "MM300CNS" -> "26RMM-CNS-300" (renomeacao aplicada no dialogo)
13:52:46  NOVA sessao da MESMA turma                  -> contexto com 0 alunos   <-- bug
```

Hoje a turma `26RMM-CNS-300` (id `877d042c-…`) tem **46 alunos** em `students` — eles existem; apenas não são carregados.

Trechos envolvidos:
- `src/components/grades/GradesImportDialog.tsx:253-286` (`loadContext`) — filtra `students` por `.eq('class', classItem.name)`.
- `src/components/grades/GradesImportDialog.tsx:636-666` (`handleRenameClass`) — atualiza banco e o estado local `effectiveName`, mas **não** a prop `classItem`.
- `src/pages/Classes.tsx:1366-1370` — `GradesImportDialog` é montado **sem** `onImported`, então a lista de turmas da página nunca é recarregada; a prop continua com o nome antigo até um refresh manual (F5).

### Por que apareceu depois da unificação
A unificação tornou `classes` canônica e introduziu o fluxo de conflito de nome de turma (`GradesClassMismatchPanel` + renomeação dentro do diálogo). Antes, renomear turma no meio da importação não acontecia. O vínculo aluno↔turma continua sendo **texto** (`students.class`), não `class_id`; qualquer renomeação cria uma janela em que a UI fica fora de sincronia. `mapping_class_id` **não** é usado para buscar alunos (apenas disciplinas esperadas, linhas 269-277), portanto o backfill não é a causa.

### Causas secundárias (ordenadas por impacto)
1. **Vínculo frágil por texto** (`students.class`): renomeação, espaços ou caixa quebram o contexto inteiro. Impacto alto, latente.
2. **Ausência de guarda para contexto vazio**: com 0 alunos carregados o sistema não avisa e trata todos como novos — risco real de duplicatas via "Cadastrar novo aluno" (`:692-712`).
3. **Sem distinção "existe no sistema, mas em outra turma"**: `matchStudent` (`src/lib/gradePageLocal/parseGradePageLocal.ts:57-73`) e o equivalente na Edge Function (`supabase/functions/parse-grade-page/index.ts:505-525`) só olham a lista da turma.
4. **Fuzzy sem trava de ambiguidade**: aceita o melhor score mesmo com dois candidatos parecidos (fuzzy a partir de 0,6), sem exigir candidato único.
5. **Normalização de nome**: `normalizeText` remove acentos/pontuação e colapsa espaços — adequada; porém não trata partículas (DA/DE/DOS) nem ordem invertida de sobrenomes. Não é a causa atual.

Verificados e **descartados** como causa: coluna de código (PDF grava e compara sempre `school_code`, consistente nos dois matchers); RLS de `students` (SELECT liberado para admin/direction/teacher, sem filtro por turma); uso de `mapping_class_id` para buscar alunos (não ocorre).

## Solução recomendada (menor risco)

1. **Fonte única do nome no diálogo**: `loadContext` passa a usar `effectiveName` (fallback `classItem.name`) e o contexto é recarregado imediatamente após a renomeação.
2. **Resolver o nome por `classes.id`**: antes de cada `loadContext`, ler `classes.name` pelo `classItem.id` no banco (uma query), eliminando a dependência de prop desatualizada.
3. **Passar `onImported` em `Classes.tsx`**, refazendo o fetch de turmas após renomeação/importação.
4. **Guarda de segurança**: contexto com 0 alunos bloqueia a importação com aviso explícito, em vez de marcar todos como novos.
5. **Matching em camadas** (abaixo) e painel de conflito com três estados distintos.

Nada disso altera o motor do IRA, a leitura de notas nem o cálculo.

## Algoritmo de matching proposto

```text
A. codigo: digitos(pdf_code) == digitos(school_code) na turma        -> match exato (score 1)
B. nome normalizado exato na turma                                  -> match (score 1)
C. nome muito semelhante (limiar alto) E exatamente 1 candidato     -> sugerir vinculo (nunca autoaceitar)
D. match por codigo/nome exato FORA da turma                        -> "existe em outra turma" (decisao manual)
E. nenhum dos casos                                                 -> conflito manual (vincular / cadastrar / ignorar)
```

Normalização de nome: NFD sem acentos, minúsculas, pontuação convertida em espaço, espaços colapsados, remoção de caracteres invisíveis, descarte de partículas (da/de/do/dos/das/e) na comparação por tokens e comparação por conjunto de tokens (ordem irrelevante). Ambiguidade (dois ou mais candidatos acima do limiar) nunca autoaceita.

## Fluxo de atualização cadastral (após match existente)

Mantém `GradesRegistrationAudit` / `gradesConflicts.ts`: campo vazio no cadastro sugere preenchimento; campo divergente exibe **diff antes/depois** com escolha "manter" ou "atualizar", sem sobrescrita silenciosa. Campos: `school_code`, `birth_date`, `mother_name`, `father_name` (e `class`, quando o aluno vem de outra turma, com confirmação). Somente admin/direção alteram esses campos — o trigger `restrict_report_card_fields` já garante isso.

## Banco de dados

Nenhuma migration é necessária para corrigir o bug. Melhoria opcional em fase posterior, fora deste escopo: coluna `students.class_id` referenciando `classes(id)`, populada por nome e mantida em sincronia, para eliminar a dependência de texto.

## Testes de regressão

- `loadContext` usa o nome atual após renomeação: contexto com 46 alunos na turma `26RMM-CNS-300`.
- Renomear a turma no diálogo e iniciar nova sessão: nenhum "não identificado" para alunos existentes.
- Match por código com pontos e zeros à esquerda ("0012.345" vs "12345").
- Match por nome com acento, cedilha, espaço duplo e ordem de partículas.
- Dois candidatos semelhantes: conflito manual, sem autoaceite.
- Aluno de outra turma: estado "existe em outra turma", nunca "novo".
- Contexto vazio: importação bloqueada com aviso.
- Atualização cadastral: divergência exige confirmação; campo vazio sugere preenchimento.

## Critérios de aceitação

1. Nenhum aluno cadastrado na turma aparece como "não identificado".
2. Renomeação de turma durante a importação não zera o contexto de alunos.
3. Duplicatas não são criadas: "cadastrar novo" só após checagem global.
4. O diálogo distingue os três estados (na turma / em outra turma / novo).
5. Atualização cadastral com diff e confirmação explícita.
6. Notas, IRA e fluxo página a página inalterados; typecheck e testes passando.