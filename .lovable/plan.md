## Atualizar regras de classificação de situação no importador PDF de alunos

### Contexto
O edge function `parse-students-pdf` classifica alunos em "ativo", "removido" ou "revisão" com base em sinais visuais (cor do texto, rachura) e na sigla da coluna **Situação** do PDF. Atualmente apenas `MTR` e `MTI` são reconhecidas como situações de aluno ativo.

### Mudanças necessárias

#### 1. Edge Function `supabase/functions/parse-students-pdf/index.ts`

- Adicionar `CTI` e `CPG` como situações de **aluno removido** (`VALID_REMOVED_SITUATIONS`).
- Ajustar a lógica de classificação para que:
  - `MTR` / `MTI` → ativo (quando preto + sem rachura, como hoje)
  - `CTI` / `CPG` → removido (independentemente de cor/rachura, pois a situação indica transferência/cancelamento)
  - Demais siglas ou ausência → comportamento atual (revisão se divergir, ou com base em cor/rachura)
- Atualizar o prompt do sistema (extração Pass 1 e Pass 2) para listar `CTI` e `CPG` como exemplos de siglas da coluna Situação, junto com as já citadas (`MTR`, `MTI`, `TRA`, `DES`, `REM`).

#### 2. Deploy
- Reimplantar o edge function `parse-students-pdf` após a edição.

### Fora de escopo
- Nenhuma alteração no frontend (`src/pages/Classes.tsx`) — a resposta do servidor continua seguindo o mesmo schema (`active`, `removed`, `review`).
- Nenhuma alteração em outros edge functions de importação PDF.