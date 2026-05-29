## Objetivo

No diálogo "Adicionar em Lote (PDF)" da aba **Turmas**, adicionar checagem rigorosa da carga horária semanal extraída do PDF e propagar as mudanças para o padrão global da disciplina.

## Mudanças em `src/components/mapping/ClassesBulkImportDialog.tsx`

### 1. Validação da soma por turma (na revisão)

Para cada turma extraída do PDF, calcular a soma de `weekly_classes` das disciplinas e comparar com a carga semanal alvo:

- Turmas existentes → usar `mapping_classes.weekly_hours` da turma já cadastrada.
- Turmas novas → usar default por turno (`evening` = 25h, demais = 30h).
- Disciplinas sem `weekly_classes` extraído → considerar fallback (`default_weekly_classes` global ou 4) já usado hoje.

Exibir na revisão, por turma:
- Badge "Soma: Xh / Yh" em verde quando bate, âmbar quando difere, vermelho quando ultrapassa.
- Aviso textual quando houver divergência ("Soma das aulas (X) difere da carga da turma (Y)").

Por disciplina, marcar visualmente (badge âmbar "atualizar padrão") quando o valor do PDF for diferente do `default_weekly_classes` global atual.

### 2. Bloqueio de importação em caso de soma incorreta

Botão "Importar" desabilitado enquanto houver pelo menos uma turma selecionada com soma ≠ carga da turma. Toast explicativo se o usuário tentar prosseguir. Permitir desmarcar turmas problemáticas para liberar.

### 3. Atualização do padrão global da disciplina

Durante `handleSave`, após resolver o nome canônico de cada disciplina:

- Agrupar, por disciplina global, todos os `weekly_classes` vindos do PDF (ignorando nulos).
- Se houver consenso (todos os valores idênticos) e for **diferente** do `default_weekly_classes` atual:
  - `UPDATE mapping_global_subjects SET default_weekly_classes = <novo>` para essa disciplina.
  - `UPDATE mapping_class_subjects SET weekly_classes = <novo> WHERE subject_name = <name>` para propagar a todas as turmas existentes (mesma estratégia já usada no `SubjectForm`).
- Se houver conflito (valores diferentes para a mesma disciplina em turmas distintas no PDF): não atualizar o padrão global, manter o valor por turma exatamente como veio do PDF, e logar um aviso no toast final.

Para disciplinas globais novas criadas na etapa 1 do save, usar o `weekly_classes` mais frequente do PDF como `default_weekly_classes` (em vez do `4` fixo atual).

### 4. Resumo no toast final

Acrescentar ao toast:
- "N disciplina(s) global(is) com padrão atualizado"
- "N turma(s) com soma divergente ignorada(s)" (se aplicável)

## Arquivos afetados

- `src/components/mapping/ClassesBulkImportDialog.tsx` (único arquivo editado)

## Fora de escopo

- Sem mudanças de schema.
- Sem alteração no Edge Function `parse-classes-pdf`.
- Sem mudanças em outras abas (Disciplinas, Distribuição, Professores).
