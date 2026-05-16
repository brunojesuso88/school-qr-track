## Diagnóstico atual

A importação de PDF em `src/pages/Classes.tsx` envia o arquivo para a edge function `parse-students-pdf`, que usa `google/gemini-2.5-flash` em **uma única passada** com prompt curto. Problemas identificados:

1. **Leitura imprecisa** — modelo `flash` em chamada única tende a confundir letras, juntar sobrenomes ou pular alunos em listas densas.
2. **Sem detecção de tachado** — alunos riscados de vermelho no PDF são lidos como ativos e acabam mantidos na turma.
3. **Sem dupla verificação** — qualquer alucinação do modelo entra direto na tela de reconciliação.
4. **Revisão sem edição** — o usuário só pode marcar/desmarcar, não consegue corrigir um nome lido errado antes de salvar.
5. **Reconciliação atual** trata "ausente no PDF" como remover, mas ignora completamente nomes tachados quando o modelo decide incluí-los.

## Mudanças propostas

### 1. Edge function `parse-students-pdf` — leitura em duas passadas

- Trocar modelo principal para `google/gemini-2.5-pro` (mais preciso em OCR de listas).
- **Passada 1 — extração**: prompt reforçado pedindo para retornar **dois arrays**:
  - `active_students`: nomes legíveis e **não** tachados/riscados.
  - `struck_students`: nomes **tachados, riscados em vermelho, com linha horizontal cortando o nome, ou marcados como removidos/desistentes**.
  - Para cada item: `full_name`, `birth_date?`, `guardian_name?`, `guardian_phone?`, mais `confidence` (0–1).
- **Passada 2 — verificação**: nova chamada ao mesmo modelo enviando o PDF + a lista da passada 1, pedindo para revisar nome a nome ("este nome está escrito exatamente assim no documento? algum está tachado e foi classificado como ativo?"). Retorna correções e reclassificações.
- Mesclar resultado: aplicar correções, mover reclassificados de `active` ↔ `struck`, deduplicar por nome normalizado.
- Resposta da função passa a ser `{ success, active: [...], struck: [...], count }` (mantém compatibilidade adicionando também `students` = active).
- Schema tool calling atualizado para refletir os dois arrays + `confidence`.
- Logs detalhados de cada passada para auditoria.

### 2. `src/pages/Classes.tsx` — reconciliação de 3 fontes

Atualizar tipo `ReconciledStudent` para incluir `source: 'pdf_active' | 'pdf_struck' | 'db_only'` e `confidence?`.

Nova lógica ao receber resposta da edge function:

```text
pdfActive  = nomes ativos no PDF (normalizados)
pdfStruck  = nomes tachados no PDF (normalizados)
existing   = alunos ativos da turma no DB

Para cada nome em pdfActive:
  - se existe no DB           → action='keep'
  - se NÃO existe no DB       → action='add'  (selected por padrão)

Para cada nome em pdfStruck:
  - se existe no DB           → action='remove' (motivo: "tachado no PDF")
  - se NÃO existe no DB       → ignorar (não havia para remover)

Para cada existing:
  - se NÃO está em pdfActive nem pdfStruck → action='remove' (motivo: "ausente no PDF")
```

### 3. UI de revisão — dupla checagem editável

Na tabela de reconciliação atual (linhas 920–960):

- Nova coluna **"Motivo"** explicando origem de cada item (Tachado no PDF / Ausente no PDF / Novo no PDF / Já cadastrado).
- Nome editável inline (input) para itens `add` e `remove` por nome ausente — permite corrigir leitura errada antes de salvar. Editar um `add` para um nome já existente reclassifica automaticamente como `keep`.
- Badge de **confiança baixa** (<0.8) em vermelho/âmbar nos itens `add`, sinalizando "revise este nome".
- Bloco de aviso no topo: "X alunos foram detectados como tachados/riscados e serão removidos" quando aplicável.
- Botão "Selecionar todos os adicionar" e "Desmarcar todos" separados.

### 4. Salvamento

`handleSaveStudents` continua igual (insert para `add`, update `status='inactive'` para `remove`), apenas usando o `full_name` editado pelo usuário (não o original do PDF) ao inserir.

## Arquivos alterados

- `supabase/functions/parse-students-pdf/index.ts` — duas passadas, struck detection, modelo pro.
- `src/pages/Classes.tsx` — tipos, lógica de reconciliação 3-fontes, UI editável com motivo e confiança.

## Sem mudanças

- Schema do banco (continua usando `students.status='inactive'` para soft-delete).
- RLS, rotas, sidebar, outras telas.

## Riscos / notas

- `gemini-2.5-pro` é mais caro/lento que `flash`; o ganho de precisão compensa para listas de alunos. Mantemos fallback para `flash` se `pro` retornar 429/402.
- Detecção de tachado depende da qualidade do PDF (escaneado vs. digital). Sempre cabe ao usuário revisar antes de aplicar.
