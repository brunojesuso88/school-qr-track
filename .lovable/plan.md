# Auditoria: “Inserir boletim da turma” não abre a tela de revisão

## A) Causa raiz provável (com evidências)

A Edge Function `parse-grades-pdf` é **morta pelo runtime antes de responder** no PDF real de 45 páginas. Logo, `supabase.functions.invoke` nunca retorna sucesso e a tela de revisão nunca é montada.

Evidências:
- Logs da função (execuções de 02:17 e 02:19 UTC de hoje): `PDF dividido em 9 bloco(s) de até 5 páginas` seguido apenas de `shutdown` — **nenhum log de conclusão, nenhum erro de bloco, nenhuma resposta**. As duas tentativas morreram no meio da extração.
- `supabase/functions/parse-grades-pdf/index.ts:17-18`: `CHUNK_PAGES = 5`, `CHUNK_CONCURRENCY = 4` → 45 páginas = 9 blocos em 3 ondas de chamadas de IA multimodais (cada uma dezenas de segundos), somando facilmente mais que o limite de execução/idle.
- `index.ts:330-397`: a resposta só é montada **depois** que todos os blocos terminam; não há resposta parcial nem streaming/keep-alive, então o cliente fica sem nenhum byte até o fim (idle timeout).
- `src/components/grades/GradesImportDialog.tsx:304-308`: qualquer erro/timeout cai no `catch`, seta `error` e **volta o step para `select`** — o usuário vê o seletor de arquivo de novo e interpreta como “a conferência não abriu”.
- `GradesImportDialog.tsx:722-726`: durante `processing` só existe um spinner sem progresso nem tempo estimado, reforçando a sensação de travamento.

Ou seja: o fluxo de revisão em si (`class-conflict` / `review`, `GradesClassMismatchPanel`, `GradesConflictsPanel`, `GradesReviewTable`) está correto — ele simplesmente nunca é alcançado.

## B) Outras falhas relevantes

1. **Perda total do trabalho parcial**: se 8 de 9 blocos forem lidos, o timeout descarta tudo; não há persistência intermediária.
2. **Chunk sem retry**: `index.ts:354-383` marca o bloco como falho no primeiro erro HTTP (429/5xx) sem nova tentativa; 4 chamadas simultâneas aumentam a chance de 429.
3. **Reconciliação já desativada em PDF longo** (`index.ts:644-646`) — sintoma de que o orçamento de tempo já estava no limite antes desta alteração.
4. **UX de erro**: voltar para `select` apaga o contexto; a mensagem não distingue timeout de PDF inválido, de créditos de IA (402) ou de permissão.
5. **Permissões**: a função exige role `admin`/`direction` (`index.ts:308`). Professor que clicar em “Inserir boletim” recebe 403 e o mesmo retorno silencioso para `select`. `supabase/config.toml` já tem `verify_jwt = false` com validação em código — correto.
6. **Payload grande em memória**: base64 do PDF completo + 9 cópias recortadas + 9 base64 de bloco em memória simultaneamente; risco adicional de pressão de memória em PDFs próximos de 10MB.
7. **`class_codes` vindo de blocos distintos** pode conter variações de leitura do mesmo código, disparando o painel de divergência de turma sem necessidade.

## C) Solução recomendada (robusta para 45+ páginas)

Trocar a chamada síncrona por um **job assíncrono com progresso**, mantendo intacta a lógica de conferência já aprovada:

- Nova tabela `grade_import_jobs` (status, total de blocos, blocos concluídos, payload parcial, resultado final, erro), com RLS para `admin`/`direction` e GRANTs.
- `parse-grades-pdf` passa a **criar o job e responder imediatamente** (`202` + `job_id`), continuando o trabalho em background (`EdgeRuntime.waitUntil`), gravando cada bloco concluído no job. Assim nenhum timeout de request derruba a extração.
- O diálogo consulta o job (polling/realtime) e mostra **progresso real** (“bloco 4 de 9 · páginas 16-20”), depois carrega o resultado e segue para `class-conflict`/`review` como hoje.
- **Resiliência por bloco**: retry com backoff em 429/5xx, blocos de 3 páginas e concorrência 3 (mais chamadas curtas em vez de poucas longas), e resultado aproveitável mesmo com bloco faltando — as páginas não lidas são listadas como erro na auditoria.
- **Erro nunca volta para `select`**: novo step `failed`, com a causa (timeout, créditos, permissão, PDF inválido) e botão “Tentar novamente” reaproveitando o mesmo arquivo.
- Regras de negócio preservadas: Faltas ignoradas, célula vazia ≠ 0 no armazenamento, zero virtual só no IRA quando a disciplina estiver selecionada.

## D) Plano de implementação por etapas

1. **Migração**: `grade_import_jobs` + RLS + GRANTs (`authenticated` para admin/direção via policies, `service_role` completo).
2. **Edge Function**: divisão em job assíncrono; resposta imediata com `job_id`; extração em background por bloco com retry; gravação incremental; montagem do resultado final no job. Blocos de 3 páginas, concorrência 3.
3. **Cliente**: `handleFile` cria o job e entra em `processing` com barra de progresso; polling do job; ao concluir, aplica exatamente a lógica atual de `detected_students`, auditoria cadastral e divergência de turma.
4. **Tratamento de erro**: step `failed` com mensagem por causa e retry; deduplicar `class_codes` por normalização antes de disparar o painel de divergência.
5. **Permissões na UI**: esconder/desabilitar “Inserir boletim da turma” para professor, evitando o 403 silencioso.
6. **Verificação**: typecheck, deploy da função e leitura dos logs de uma execução completa.

## E) Critérios objetivos de teste

1. PDF real de 45 páginas / 45 alunos (turma 26RMM100): o diálogo mostra progresso e **chega à tela de revisão**, sem 504.
2. `stats.pages = 45` e alunos detectados = 45; nenhuma página listada como não lida.
3. Nenhuma linha de nota com período contendo “Faltas”.
4. Células vazias permanecem `null` na revisão (não 0,00) e “0,00” do PDF aparece como zero real.
5. Divergência de turma: com PDF de outra turma, o painel de divergência abre e nada é gravado até a decisão.
6. Conflitos de aluno pendentes bloqueiam o botão de confirmar importação.
7. Erro forçado (créditos/permissão): aparece o step de falha com a causa e o botão de repetir — nunca volta silenciosamente ao seletor.
8. Logs da função: um ciclo completo com todos os blocos concluídos e sem `shutdown` antes do fim.
