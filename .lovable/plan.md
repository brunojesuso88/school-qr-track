## Objetivo

Reforçar a interpretação do PDF na função "Adicionar em Lote (PDF)" da aba Turmas para garantir que cada turma totalize 30h semanais (25h noite), detectar aulas duplas, evitar contagem duplicada de disciplinas e mostrar diagnóstico claro de divergências.

## Mudanças

### 1. Edge function `supabase/functions/parse-classes-pdf/index.ts`

Reforçar o prompt e o schema para a IA extrair melhor:

- Acrescentar instrução explícita: "Aulas DUPLAS (dois períodos seguidos com a mesma disciplina/professor no mesmo dia) contam como **2 aulas**, não 1. Some todas as ocorrências da disciplina na semana, contando cada período individual."
- Pedir validação de soma: o total semanal de cada turma deve ser **30** (manhã/tarde) ou **25** (noite). Se a soma divergir, a IA deve revisar a contagem antes de retornar.
- Schema: adicionar campo opcional `weekly_total_expected` por turma e `notes` (string) onde a IA registra observações sobre aulas duplas detectadas ou divergências percebidas.
- Schema da disciplina: adicionar `double_periods` (number, opcional) — quantidade de blocos duplos detectados — para auditoria.
- Adicionar deduplicação server-side: se a IA retornar a mesma disciplina duas vezes na mesma turma (mesmo nome canônico), consolidar somando `weekly_classes` e logar em `notes`.

### 2. Componente `src/components/mapping/ClassesBulkImportDialog.tsx`

#### 2a. Deduplicação no parsing client-side
Ao receber o resultado, após `result.map(...)`:
- Agrupar `c.subjects` por nome canônico (`resolveSubjectName`). Se houver duplicatas na mesma turma, somar os `weekly_classes`, preservar o primeiro professor não-nulo e marcar a entrada com flag `merged_from: number` (quantas linhas foram fundidas).
- Renderizar badge "consolidada (N→1)" quando `merged_from > 1`.

#### 2b. Diagnóstico de divergência detalhado
Substituir o alerta atual genérico por motivos específicos. Criar helper `getDivergenceReasons(c)` que retorna lista de strings:
- `"Disciplinas duplicadas consolidadas (X)"` — quando alguma disciplina tinha `merged_from > 1`.
- `"Disciplinas sem carga (X)"` — quando alguma `weekly_classes` veio nula/zerada do PDF.
- `"Sobrecarga: Yh acima do alvo"` — quando soma > alvo.
- `"Subcarga: Yh abaixo do alvo"` — quando soma < alvo.
- `"Aulas duplas detectadas: N"` — quando `double_periods > 0` (informativo).
- `"Carga semanal alvo: 30h (manhã/tarde) ou 25h (noite)"` — sempre que houver divergência, reforçar a regra.

Renderizar essa lista como bullet abaixo do card, em vez do parágrafo único atual.

#### 2c. Validação 30h fixa
- `getTargetHours` continua usando 30/25 por turno, mas adicionar aviso visual quando `mapping_classes.weekly_hours` da turma existente difere de 30/25 — badge "alvo fora do padrão (Yh)" para o admin perceber.
- Botão "Forçar 30h" por turma: distribui igualmente respeitando 30h fixo (ignora o `weekly_hours` salvo da turma) — útil quando o PDF e o cadastro estão ambos errados.

#### 2d. Dupla verificação visual
- No header de cada card, junto ao badge "Soma: Xh/Yh", adicionar contador `Σ por disciplina: N disciplina(s) · M aula(s)` para o usuário conferir rapidamente.
- Listar disciplinas duplicadas detectadas em um banner amarelo no topo da revisão (resumo geral): `"X disciplinas consolidadas em Y turmas — revise as quantidades"`.

### 3. Sem mudanças em schema

Nenhuma alteração de tabela. Apenas componente + edge function.

## Arquivos afetados

- `supabase/functions/parse-classes-pdf/index.ts`
- `src/components/mapping/ClassesBulkImportDialog.tsx`

## Fora de escopo

- Outras abas (Professores, Disciplinas).
- Mudanças no fluxo de save (já usa os valores corrigidos).
