# Aprimorar Importação PDF de Alunos por Turma

Atualizar a função "Adicionar PDF" (botão upload nos cards de Turmas) para realizar leitura completa, dupla checagem com regras explícitas de cor/rachura/situação, e exibir tela de revisão obrigatória antes de gravar.

## 1. Edge Function `parse-students-pdf` (reescrita do prompt e schema)

**Pass 1 — Extração visual completa**

Substituir o prompt atual para que o Gemini retorne, para CADA linha encontrada em TODAS as páginas do PDF:
- `full_name`
- `name_color`: `"black" | "red" | "other"` (cor predominante do texto)
- `has_strikethrough`: boolean (rachura/linha cortando)
- `situacao`: string crua extraída da coluna Situação (ex. "MTR", "MTI", "TRA", vazio)
- `page`: número da página
- `extraction_confidence`: 0–1
- `guardian_name`, `guardian_phone`, `birth_date` quando disponíveis

Instruir explicitamente: "Não classifique nada. Apenas reporte o que vê. Examine TODAS as páginas."

**Pass 2 — Verificação independente**

Segunda chamada (independente) revisa o PDF e devolve para cada nome:
- `verified_name_color`
- `verified_has_strikethrough`
- `verified_situacao`
- `verification_confidence`

**Classificação no servidor (determinística, não na IA)**

Para cada entrada, combinar Pass 1 + Pass 2:
- `ALUNO_ATIVO` se ambos os passes concordam: cor preta + sem rachura + situação ∈ {`MTR`,`MTI`}
- `ALUNO_REMOVIDO` se ambos concordam: cor vermelha OU rachurado
- `NECESSITA_REVISAO` se:
  - divergência entre Pass 1 e Pass 2 em qualquer campo crítico
  - confidence < 0.7 em qualquer passe
  - nome vazio / OCR suspeito (regex de caracteres inválidos)
  - situação fora de {`MTR`,`MTI`} mas sem rachura/vermelho
  - cor `"other"` ou situação ilegível

Resposta nova:
```json
{
  "success": true,
  "active": [...],          // ALUNO_ATIVO
  "removed": [...],         // ALUNO_REMOVIDO (com motivo: red|strike|both)
  "review": [...],          // NECESSITA_REVISAO (com motivo)
  "stats": { "pages": N, "total": N, "active": N, "removed": N, "review": N },
  "errors": []              // estrutura desconhecida, OCR falho etc.
}
```

Se Pass 1 falhar com estrutura irreconhecível → retornar `success:false` com mensagem clara.

## 2. Frontend — `src/pages/Classes.tsx`

**Estado**

Substituir `extractedStudents` / `reconciled` por:
- `pdfActive`, `pdfRemoved`, `pdfReview`, `pdfStats`

**Reconciliação**

Cruzar com `students` ativos da turma (mesma query atual):
- ativo no PDF + não existe no banco → ação `add`
- ativo no PDF + existe → ação `keep` (com possibilidade de atualizar campos)
- removido no PDF + existe → ação `remove` (marca `status='inactive'`, sem delete)
- ativo no banco + ausente no PDF → vai para seção `review` com motivo "ausente no PDF"
- registros `review` do servidor → seção `review`

**Modal de Conferência (novo layout, 3 abas/seções)**

Aba 1 — "Alunos Ativos Detectados" (verde): tabela com Nome, Situação (MTR/MTI), Status, checkbox de inclusão (pré-marcados se `add`).

Aba 2 — "Alunos Removidos Detectados" (vermelho): Nome, motivo (Vermelho / Rachurado / Ambos), checkbox para confirmar remoção.

Aba 3 — "Registros com Inconsistências" (amarelo): Nome, motivo da inconsistência, campo editável para corrigir nome e selector para reclassificar como Ativo/Removido/Ignorar.

Cabeçalho do modal mostra `pdfStats` (páginas lidas, totais por categoria) e nome do arquivo.

**Botões**
- `Cancelar` — fecha sem alterar
- `Revisar` — mantém modal aberto para edição manual
- `Confirmar Importação` — executa gravação (desabilitado enquanto existirem itens de `review` não resolvidos)

**Gravação**
- Insert dos `add` selecionados
- Update `status='inactive'` para `remove` selecionados
- Itens `review` reclassificados manualmente entram nos lotes correspondentes
- Nunca DELETE

## 3. Auditoria

Inserir registro em `audit_logs` após gravação bem-sucedida com `action='PDF_IMPORT'`, `table_name='students'`, `new_data` contendo: `class_name`, `pdf_filename`, `pages_read`, `active_detected`, `removed_detected`, `review_count`, `added_ids`, `removed_ids`, `timestamp`. (Tabela já existe; o `user_id` vem de `auth.uid()` via inserção autenticada — adicionar policy de INSERT para roles admin/direction/teacher.)

## 4. Tratamento de Erros

- PDF inválido / estrutura desconhecida / falha total de OCR: edge function retorna erro estruturado; UI exibe mensagem clara e bloqueia importação.
- Qualidade baixa (muitos `review` ou confidence média < 0.6): banner de aviso no modal.

## Arquivos afetados

- `supabase/functions/parse-students-pdf/index.ts` — novo prompt, schema e lógica determinística
- `src/pages/Classes.tsx` — novo modal de conferência (3 seções), tipos, fluxo de salvamento e auditoria
- Nova migração: policy de INSERT em `audit_logs` para admin/direction/teacher (atualmente só SELECT está aberto)

## Fora de escopo

- Outras abas de importação PDF (alunos, professores, disciplinas)
- Mudanças visuais nos cards de turma
