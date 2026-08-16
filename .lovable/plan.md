# Fase 2 — Leitura local determinística do boletim (`parse-grade-page-local`)

## Auditoria do que existe hoje (verificado)

- `supabase/functions/parse-grade-page/index.ts` (656 linhas): ações `create` / `page` / `status` / `cancel`. Em `page`, recorta a página com `pdf-lib` (`extractSinglePage`) e envia o PDF de 1 página em base64 ao AI Gateway (`gemini-2.5-flash`, escalando para `2.5-pro` quando `suspicionReasons()` acusa problema). A normalização da prévia (períodos, disciplinas, casamento de aluno, flags, `stats`, `detected`) já é determinística e local — só a leitura das células é da IA.
- Bibliotecas de PDF no projeto: `pdf-lib` (apenas na Edge Function, via `npm:`), `jspdf` + `jspdf-autotable` (geração). **Não existe hoje nenhuma biblioteca de extração de texto/coordenadas** — `pdfjs-dist` não está no package.json.
- Frontend: `src/components/grades/GradesImportDialog.tsx` chama `invoke('parse-grade-page', {action:'page'})`, recebe `PagePreview` e converte em `ReviewRow[]` com `source:'import'`.
- Camadas de bloqueio existentes que serão respeitadas sem alteração: `gradesAutoAccept.ts`, `gradesConflicts.ts`, `GradesReviewTable.tsx` (flags), `GradesClassMismatchPanel`, `GradesRegistrationAudit`.

## Arquitetura proposta

A extração local acontece **no frontend**, onde o PDF já está em memória (o usuário acabou de selecioná-lo) — evita base64 de ida e volta e é onde `pdfjs-dist` entrega coordenadas nativas.

```text
PDF selecionado (browser)
      |
      v
[1] parseGradePageLocal(pdfDoc, pageNumber)   <- novo, determinístico, pdfjs-dist
      |  tokens + bounding boxes -> grade de células
      v
[2] validateLocalPage()  (determinístico, limiares quantitativos)
      |
      +-- confiável (score >= limiar) ------> prévia (source='local')
      |
      +-- inconclusivo / suspeito ---------> [3] parse-grade-page (IA, já existente)
                                                  |
                                                  +-- reconcilia local x IA
                                                        divergência => reconciliation_divergence
      v
[4] confirmação humana página a página (fluxo atual, inalterado)
```

## Arquivos

Criar:
- `src/lib/gradePageLocal/pdfText.ts` — abre o documento com `pdfjs-dist` e extrai por página os itens de texto com `transform` (x, y), `width`, `height`, `str`, normalizando para tokens `{text, x, y, w, h, page}`.
- `src/lib/gradePageLocal/layout.ts` — agrupa tokens em linhas (clustering por y com tolerância proporcional à altura da fonte) e em colunas (faixas de x); reconstrói a matriz de células.
- `src/lib/gradePageLocal/header.ts` — cabeçalho do aluno: `Aluno(a)`, `Código`, `Data de Nascimento`, `Mãe`, `Pai`, `Turma`, por rótulo âncora + token à direita na mesma linha.
- `src/lib/gradePageLocal/parseGradePageLocal.ts` — orquestra e devolve o objeto no formato `PagePreview`.
- `src/lib/gradePageLocal/validate.ts` — validação determinística e score de confiança.
- `src/lib/gradePageLocal/normalize.ts` — normalização de acentos/pt-BR e parsing de notas (mesmas regras de `parseGradeValue`).
- `src/lib/gradePageLocal/__tests__/*.test.ts` — testes unitários e de regressão.

Alterar:
- `src/components/grades/GradesImportDialog.tsx` — tentar local primeiro, cair para a Edge Function, reconciliar e alimentar a prévia; feature flag na UI.
- `src/components/grades/GradesReviewTable.tsx` — apenas rótulo de origem (`Leitura local` / `Leitura IA`).

Não alterar: `parse-students-pdf`, `parse-classes-pdf`, `parse-teachers-pdf`, `parse-grades-pdf`, `src/lib/ira.ts`, `iraRanking.ts`, as tabelas de sessão (`grade_import_sessions`, `grade_import_session_pages`), o fluxo de gravação e a confirmação página a página.

Dependência nova: `pdfjs-dist` (worker carregado via `?url` no Vite).

## Algoritmo de reconstrução da tabela

1. **Tokens**: `page.getTextContent()`; para cada item, `x = transform[4]`, `y = transform[5]`; descartar tokens vazios.
2. **Linhas**: ordenar por `y` decrescente; agrupar tokens cujo `|Δy| <= 0,6 × altura mediana da fonte`.
3. **Cabeçalho da grade**: localizar a linha que contém `1º`/`2º`/`3º`/`4º` + (`Período`|`Bimestre`|`Etapa`) e a linha imediatamente abaixo com `Nota`/`Faltas`. Cada rótulo de período define uma faixa horizontal `[x_ini, x_fim)`; dentro dela, a subcoluna cujo rótulo normalizado casa `nota` é aceita e a que casa `falta` é **descartada já aqui**, antes de qualquer parsing — Faltas nunca entra no pipeline.
4. **Colunas finais**: mesmo mecanismo para `Média Final`, `Rec. Final`, `Cons. Class`, `Pendência`, `Final` (reaproveitando a lógica de `classifyPeriod`/`PERIOD_ORDER`).
5. **Linhas de disciplina**: linhas abaixo do cabeçalho cujo primeiro token cai na faixa x da coluna de disciplina e cujo texto normalizado é alfabético (rejeita rodapé e legendas).
6. **Vínculo token→célula**: em cada linha de disciplina, cada token numérico é atribuído à coluna cujo intervalo x contém o **centro** do token; token cruzando dois intervalos, ou dois tokens na mesma célula, marca a célula como ambígua.
7. **Vazio vs zero**: célula sem token → `note_raw = null` (`empty_cell`); token `0,00`/`0`/`0,0` → valor `0` (`explicit_zero`); `—`, `-`, `n/a` → `null`. Vazio nunca vira zero.

## Normalização de tokens

- Reutilizar a normalização atual (NFD + remoção de diacríticos + lowercase) para rótulos.
- Notas: aceitar `^\d{1,2}([.,]\d{1,2})?$`; recusar `>10` (fora de escala) e valores com 3+ dígitos inteiros (provável código ou falta).
- Proteções contra confusão: tokens da coluna Faltas já removidos por geometria; código do aluno só é lido na região do cabeçalho; `Média Final` e afins entram como período de tipo próprio, nunca como período 1–4.

## Tolerância a variações de formato

Nada é fixado por coordenada absoluta: todas as faixas vêm dos rótulos detectados na própria página. Se faltar cabeçalho de período, se não houver subcoluna `Nota` reconhecível, se a página não tiver camada de texto (PDF escaneado) ou se as disciplinas detectadas ficarem abaixo de 50% do esperado da turma, a página é marcada **`local_inconclusive`** e segue para a IA.

## Pipeline de confiança (critérios quantitativos)

A leitura local vai à revisão humana **sem IA** quando **todas** as condições valem:
- camada de texto presente e >= 40 tokens na área da grade;
- períodos detectados >= 1 e todos classificados (`kind != unknown`);
- subcoluna `Nota` identificada em 100% dos períodos detectados;
- disciplinas detectadas >= 80% das disciplinas esperadas da turma (quando a turma tem disciplinas cadastradas);
- 0 células ambíguas por geometria;
- 0 valores inválidos e 0 fora da escala 0–10;
- 0 duplicidades conflitantes (mesma disciplina×período com valores diferentes);
- aluno resolvido com `match_score >= 0,95` (mesma regra atual).

A IA é chamada quando qualquer item acima falha, quando a página é `local_inconclusive`, ou quando o usuário liga "Validar sempre com IA".

`confidence` por célula na leitura local: `1.0` para célula única e centrada; `0.85` para token deslocado mas dentro da faixa; `< 0.7` (gera `low_confidence`) para célula ambígua — mantendo os bloqueios de auto-aceite já existentes.

## Reconciliação local × IA

Quando a IA é chamada, ela é **validadora**: para cada `disciplina × período`, comparar `note_numeric` local e IA.
- Iguais → mantém local e adiciona `reconciled_match`.
- Diferentes (inclusive null vs valor) → exibe o valor **local**, guarda o da IA em `second_pass_value` e adiciona `reconciliation_divergence` (já bloqueia auto-aceite e destaca a linha).
- Célula existente só na IA → linha adicionada com `source='ai'` e `reconciliation_divergence`.

A IA nunca sobrescreve silenciosamente a leitura local.

## Formato de saída

Mesmo objeto `PagePreview` de hoje (`student`, `detected`, `subjects`, `periods`, `rows`, `stats`, `notes`, `reading`), com:
- `ReviewRow.source` passando a aceitar `'local' | 'ai' | 'import' | 'manual'`;
- `reading.mode`: `'local' | 'local_validated' | 'ai_fallback'`, mais `reading.local_score` e `reading.reasons`;
- `confidence` numérico por linha, como a tabela já consome.

## Fallback

Falha total do parser local (exceção, PDF sem texto, `local_inconclusive`) → chamada normal a `parse-grade-page` com o fluxo atual, sem mudança visível além de um aviso "leitura por IA". A Edge Function permanece intacta e continua sendo o caminho para PDFs escaneados.

## Performance

- Extração local inteiramente no browser, sem rede e sem base64 — alvo < 300 ms/página contra os segundos atuais da IA.
- O documento `pdfjs` é aberto **uma vez** por sessão e reutilizado em todas as páginas.
- Quando a IA é necessária, só então a página é recortada e enviada (fluxo atual); nunca o PDF completo.

## Segurança e privacidade

- Páginas resolvidas localmente não saem do dispositivo.
- Envio à IA apenas da página isolada e do contexto mínimo já usado hoje.
- Sem novas permissões: a Edge Function continua exigindo `admin`/`direction` via `requireAuth`; a leitura local herda a sessão e as regras de acesso atuais na gravação.

## Testes

Fixtures a partir do boletim real de 45 páginas já usado no projeto, com tokens + coordenadas de cada página salvos em JSON (nomes substituídos nos casos versionados).

Casos obrigatórios: páginas **1, 18, 24, 41, 42 e 45**, cobrindo:
- `0,00` real preservado como zero (`explicit_zero`);
- células vazias permanecendo `null` (`empty_cell`);
- disciplinas preenchidas só em períodos tardios;
- correspondência período↔coluna correta em todas as linhas;
- **nenhuma** célula de Faltas nas linhas de saída;
- cabeçalho: nome, código, nascimento, mãe, pai, turma.

Regressão: snapshot por página comparando a saída local com a saída aceita da IA; e teste de rejeição (página sem camada de texto → `local_inconclusive`).

## Critérios de aceitação

- >= 80% das páginas resolvidas localmente sem chamar IA neste boletim;
- 0 notas trocadas entre disciplinas/períodos nas páginas de teste;
- 0 faltas importadas;
- tempo médio por página < 500 ms no caminho local;
- toda divergência local×IA visível na revisão, nenhuma sobrescrita silenciosa;
- fluxo de confirmação página a página e regras do IRA idênticos aos atuais.

## Rollout

- Flag no diálogo de importação: "Leitura local + validação por IA" (padrão ligado), com opções "Sempre validar com IA" e "Somente IA (modo anterior)".
- Log comparativo por página (modo, score local, motivos, nº de divergências) gravado em `grade_import_session_pages.preview_json.reading` — sem nova tabela.
- Desligar o parser local é troca de flag, sem migração nem redeploy da Edge Function.