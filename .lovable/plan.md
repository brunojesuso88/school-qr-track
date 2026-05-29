## Objetivo

Permitir edição manual da quantidade de aulas/semana de cada disciplina diretamente no card de revisão do diálogo "Adicionar em Lote (PDF)" da aba Turmas, com recálculo em tempo real do total por turma.

## Mudanças em `src/components/mapping/ClassesBulkImportDialog.tsx`

### 1. Input editável por disciplina

Substituir o texto estático `· {s.weekly_classes}h` no `<li>` de cada disciplina por um `<Input type="number">` compacto (~56px de largura, `min=1`, `max=10`):

- Valor controlado por `s.weekly_classes` (com fallback para o `default_weekly_classes` global ou 1 se vazio).
- `onChange` chama `updateSubjectWeekly(classIdx, subjectIdx, newValue)` que atualiza o `extracted[classIdx].subjects[subjectIdx].weekly_classes`.
- Label curta ao lado: "aulas/sem".

### 2. Recálculo em tempo real

Como `getClassSum`, `getSumStatus` e `invalidCount` já derivam de `extracted`, o badge "Soma: Xh / Yh", o alerta de divergência e o texto do botão "Atualizar/Importar" são reavaliados automaticamente a cada digitação.

### 3. Indicador de inconsistência por disciplina

Quando o usuário edita um valor e ele difere do extraído originalmente pelo PDF, mostrar uma marca discreta (badge `editado` em outline) para indicar que foi corrigido manualmente.

Preservar o valor original do PDF em uma propriedade `original_weekly_classes` no `ExtractedSubject` para permitir a comparação.

### 4. Botão "Distribuir igualmente"

Adicionar um pequeno botão por turma "Distribuir restante" que, ao clicar, soma o que falta/excede e ajusta proporcionalmente as disciplinas da turma para bater com a carga semanal alvo (`mapping_classes.weekly_hours` ou default por turno). Útil quando o PDF errou todas as contagens de uma turma.

### 5. Validação no save

Manter a lógica existente: o `getClassSum` agora reflete o valor editado, então o fluxo de update de `mapping_class_subjects.weekly_classes`, propagação para `mapping_global_subjects.default_weekly_classes` (consenso) e atualização de `mapping_classes.weekly_hours` (quando divergente) já passa a usar os valores corrigidos pelo usuário.

## Arquivos afetados

- `src/components/mapping/ClassesBulkImportDialog.tsx` (único arquivo)

## Fora de escopo

- Sem mudanças em schema, edge function ou outras abas.
- Sem dupla extração via IA — confiamos na correção manual do usuário antes do save.
