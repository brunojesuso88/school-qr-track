# Auditoria: 16 células "somente a IA identificou" na reconciliação do boletim

## Diagnóstico

A causa raiz não é a IA inventando linhas nem falha geométrica do `subjectColumnEnd`. É uma regra explícita do parser local: uma linha de disciplina só é aceita se tiver ao menos um token dentro da grade. As quatro disciplinas relatadas (APROFUNDAMENTO IF - CNS - I, FILOSOFIA, HISTORIA, IDENTIDADE E PROTAGONISMO) aparecem no boletim com os 4 períodos totalmente vazios, então a linha é descartada localmente e nenhuma célula local existe. A IA lista as mesmas 4 disciplinas × 4 períodos com valor `—`. Na reconciliação essas 16 células caem no ramo "célula que só a IA viu", recebem `reconciliation_divergence` + `ai_only` e bloqueiam sempre — mesmo sem nenhuma nota em disputa.

Evidência no banco: a turma `26RMM-CNS-300` tem 12 registros em `grade_subjects` contra 16 disciplinas no mapeamento — faltam exatamente Filosofia, História, Identidade e Protagonismo e o Aprofundamento I. O padrão "linha vazia = disciplina inexistente" já se repete nessa turma.

## Evidências no código

1. `expectedSubjects` (`GradesImportDialog.tsx:333-343`) vem somente de `mapping_class_subjects` filtrado por `classes.mapping_class_id`. Sem `mapping_class_id`, a lista esperada é vazia. `grade_subjects` só é lido para conflito de notas (`:410`) e escrito na gravação (`:995-1020`); nunca serve de âncora de leitura.
2. Nomenclatura divergente: no mapeamento dessa turma os nomes são `Aprfl`, `Aprfll`, `Português`, `Inglês`; no PDF e em `grade_subjects` são `APROFUNDAMENTO IF - CNS - II`, `LINGUA PORTUGUESA`, `LINGUA INGLESA`. A `similarity()` por tokens (`normalize.ts`) não casa esses pares, a cobertura cai, `validate.ts` acusa "Disciplinas lidas abaixo do esperado" e a página escala para IA — o gatilho da reconciliação.
3. Linha descartada: `layout.ts:201-207` exige `insideGrid` (token dentro de `columns`/`absenceColumns`/`ignoredColumns`). Linha só com o nome da disciplina → `continue`, sem `subjects.push` e sem células.
4. Filtro adicional: `isSubjectLabel` + `SUBJECT_STOPWORDS` (`layout.ts:155-173`). `HISTORIA` e `FILOSOFIA` passam, mas nomes longos como `APROFUNDAMENTO IF - CNS - I` dependem de estar inteiros na mesma linha e à esquerda de `subjectColumnEnd`; se quebrarem em duas linhas, geram duas "meias-linhas" sem tokens na grade.
5. `classes.series` existe, mas hoje só é usada no filtro do PDF de ranking do IRA — não influencia disciplina alguma.
6. Reconciliação: `reconcile.ts:61-69` empurra toda célula vista só pela IA para `rows` com `source: 'ai'`; `gradesAutoAccept.ts` marca `ai_only` e bloqueia sempre, inclusive quando o valor da IA é vazio (`—`).

## Como distinguir "IA inventou" de "linha existe e o local não viu"

Critério determinístico, sem IA: procurar na página uma linha cujo trecho à esquerda de `subjectColumnEnd` case com a disciplina (nome exato, alias, abreviação ou similaridade alta com candidato único). Se essa linha existe, a disciplina é real e o parser local deve materializá-la com 4 células `null`. Se não há token algum na coluna de disciplinas correspondente, a linha foi alucinada e deve ser descartada, não bloqueada.

## Arquitetura recomendada

Não criar tabelas novas. Falta apenas uma entidade canônica para "matriz por série" e um catálogo de aliases:

- `mapping_global_subjects` passa a ser o catálogo canônico (já tem `name`, `abbreviation`, `default_weekly_classes`), acrescido de `series` (1/2/3, nulo = todas) e `aliases text[]` com os nomes como aparecem no boletim (`LINGUA PORTUGUESA`, `APROFUNDAMENTO IF - CNS - I`).
- `classes.series` (já existe) passa a ser obrigatória ao vincular mapeamento e seleciona a matriz padrão.
- `mapping_class_subjects` continua a matriz da turma (herda da série, permite extras e edição).
- `grade_subjects` continua sendo o que o boletim realmente trouxe — nunca semeado sem PDF.

Fluxo: matriz por série no catálogo global → herança para `mapping_class_subjects` ao vincular série+mapeamento → `GradesImportDialog` monta `expectedSubjects` de `mapping_class_subjects` ∪ `grade_subjects` da turma ∪ aliases do catálogo → parser local usa essa lista como âncora.

## Algoritmo local para linha totalmente vazia (sem nota falsa)

1. Montar por sessão um índice de âncoras: `normalizeText(nome)` + aliases + abreviação de cada disciplina esperada.
2. Em `buildCells`, quando `insideGrid` for falso, tentar âncora com o texto à esquerda de `subjectColumnEnd`: igualdade normalizada, prefixo, ou `similarity >= 0.82` com candidato único.
3. Fusão de linhas: se não casar, concatenar com a linha adjacente quando ambas só têm tokens na coluna de disciplinas e o `y` é contíguo (nome quebrado em duas linhas).
4. Casando, criar uma célula por período com `raw_value: null`, `value: null`, `invalid: false`, `confidence: 1`, flag `empty_cell` e marca `anchored_subject_row`. Vazio continua `null`.
5. Sem âncora, mantém o comportamento atual (linha ignorada).
6. `validate.ts`: contar linhas ancoradas na cobertura e registrar motivo informativo "disciplina reconhecida por âncora, sem notas" (não bloqueante).

## Reconciliação de linhas IA-only vazias

- IA-only com valor vazio e disciplina presente localmente (agora ancorada) → não é divergência: casa com a célula local `null` (`reconciled_match`).
- IA-only vazia e disciplina sem âncora nem token na página → descartar com nota `ai_only_empty_discarded`; não bloqueia.
- IA-only com valor numérico → continua divergência bloqueante, como hoje.

## Riscos

- Alias mal cadastrado pode ancorar disciplina errada: mitigado por candidato único e limiar alto.
- Fusão de linhas pode juntar legenda/rodapé: mitigado pelos `HARD_STOPWORDS` existentes e pela exigência de âncora.
- Herança por série não deve sobrescrever turma já ajustada: aplicar só em turma sem disciplinas ou via ação explícita.
- Descartar IA-only vazia remove um bloqueio: aceitável porque não há nota em jogo (vazio = `null` nos dois lados).

## Plano de implementação em etapas

1. Catálogo: migration com `series` e `aliases` em `mapping_global_subjects`; UI em Mapeamento > Disciplinas para editar ambos, semeando aliases a partir dos nomes já vistos em `grade_subjects`.
2. Herança: `classes.series` obrigatória no vínculo e ação "aplicar matriz da série" que popula `mapping_class_subjects` preservando extras.
3. Contexto de leitura: `GradesImportDialog` monta `expectedSubjects` de `mapping_class_subjects` ∪ `grade_subjects` ∪ aliases, com campo `aliases` por disciplina.
4. Parser local: âncoras, fusão de linhas e linhas totalmente vazias em `layout.ts`/`parseGradePageLocal.ts`; ajuste de cobertura em `validate.ts`.
5. Reconciliação: novo tratamento de IA-only vazia em `reconcile.ts` e `gradesAutoAccept.ts`; `GradesDivergencePanel` distingue "vazio confirmado" de "divergência real".
6. Testes vitest: 4 períodos vazios ancorados; nome quebrado em duas linhas; alias `Aprfl` → `APROFUNDAMENTO IF - CNS - I`; IA-only vazia com âncora (match) e sem âncora (descartada); IA-only com número (bloqueia); nenhuma nota falsa criada.
7. Verificação em dados reais na turma `26RMM-CNS-300`: as 4 disciplinas passam a aparecer com os 4 períodos vazios e sem pendência.