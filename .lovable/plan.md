# Auditoria — Importação de PDF em "Eventos e Atas"

Fiz uma auditoria completa do fluxo: **PDF → IA (parse-event-pdf) → formulário → banco → card/detalhe**. Encontrei **9 falhas** que explicam por que algumas informações do evento não aparecem no card.

---

## Diagnóstico

### A. Problemas no extrator de IA (`supabase/functions/parse-event-pdf/index.ts`)

1. **Schema permissivo demais** — apenas `title` e `resumo_ia` são obrigatórios. A IA pode (e frequentemente faz) omitir `enfoque`, `metas`, `pontos_atencao`, `acoes_estrategicas`, `procedimentos`, `responsaveis`, `prazo_inicio`, `prazo_fim`, `tags` — ficando vazios no card.
2. **Prompt genérico** — "Analise o documento e preencha os campos" não orienta o modelo a procurar cada seção (Enfoque, Metas SMART, Pontos de atenção, Ações no infinitivo, Procedimentos no gerúndio, Responsáveis, Datas). Sem few-shot ou descrição clara, o Gemini extrai pouco.
3. **Status e modalidade ausentes do schema** — `status` e `is_continuous` não são extraídos; todo evento importado nasce como "planejado / pontual" mesmo quando a ata diz o contrário.
4. **Datas inválidas viram string vazia** — quando a IA devolve `prazo_inicio: ""`, o `save()` envia `""` para uma coluna `date`, gerando erro silencioso ou data nula. Falta normalizar `""` → `null`.
5. **Forçar gerúndio/infinitivo distorce o original** — o prompt manda transformar verbos. Em extração de PDF, deveria preservar a redação original e só normalizar quando o usuário clicar em "Preencher com IA".

### B. Problemas no merge do formulário (`EventFormDialog.tsx` → `importPdf`)

6. **Spread sem normalização** — `setData(d => ({ ...d, ...res.event }))` aceita campos `null`/`""` da IA e sobrescreve, mas arrays ausentes ficam vazios sem aviso. Não há feedback de "X campos preenchidos / Y vazios".
7. **Sem fallback** — se o Gemini falhar em ler o PDF (vision), não há extração de texto via `pdftotext` ou segunda tentativa. O usuário recebe sucesso mas o formulário fica vazio.

### C. Problemas de exibição no card (`EventCard.tsx`)

8. **Card oculta dados importados** — mesmo quando a importação funciona, o card mostra apenas: título, enfoque (1 linha), resumo (2 linhas), datas, responsáveis (3) e tags (6). Não há indicadores de:
   - quantidade de ações estratégicas / procedimentos
   - presença de metas / pontos de atenção
   - anexo PDF original
   
   Resultado: usuário pensa que "as informações não foram importadas", quando na verdade estão no banco mas escondidas no card.

### D. Problema de tipo (`types.ts`)

9. **`EventStatus` sem `'cancelado'`** — caso a IA retorne um status fora do enum, o `STATUS_COLORS[event.status]` retorna `undefined` e quebra o badge.

---

## Plano de correção

### 1. Reforçar `parse-event-pdf` (edge function)
- Schema com **todos os campos obrigatórios** (com defaults vazios permitidos por array, mas o modelo é instruído a preencher).
- Prompt detalhado em PT-BR descrevendo cada seção esperada em uma ata escolar brasileira (com exemplos).
- Adicionar `is_continuous` e `status` ao schema (com inferência: ex. "projeto anual" → contínuo).
- Trocar modelo para `google/gemini-2.5-pro` (melhor em extração estruturada de PDF longo) com fallback para `2.5-flash` em caso de 429.
- Instruir a IA a **preservar a redação original** do documento em vez de reformular.

### 2. Normalizar resposta no `importPdf` (frontend)
- Função `normalizeEventFromAI(raw)` que:
  - Converte `""` em `null` para datas
  - Converte strings tipo "março de 2026" → `YYYY-MM-DD` quando possível
  - Garante arrays (`acoes_estrategicas`, etc.) sempre presentes
  - Aplica defaults seguros (`status: 'planejado'`, `is_continuous: false`)
- Toast de feedback contando campos preenchidos: *"PDF analisado: 8 de 11 campos preenchidos"*.
- Botão "Revisar campos vazios" rolando para a primeira aba com pendência.

### 3. Enriquecer o `EventCard`
- Linha de "métricas rápidas": `📌 4 ações · 6 procedimentos · 3 responsáveis · 📎 PDF`
- Mostrar trecho de `metas` quando existir (1 linha truncada).
- Ícone discreto indicando "Importado de PDF" quando `pdf_original` estiver presente, com link para baixar o original.

### 4. Sanitizar `save()` no `EventFormDialog`
- Converter `prazo_inicio`/`prazo_fim` `""` → `null` antes do insert/update.
- Validar `status` contra o enum, caindo para `'planejado'` se inválido.

### 5. (Opcional) Indicador visual durante upload
- Mostrar quais campos foram preenchidos pela IA com um pequeno ✨ ao lado do label, removível ao editar.

---

## Arquivos afetados

- `supabase/functions/parse-event-pdf/index.ts` — schema + prompt + modelo
- `src/components/events/EventFormDialog.tsx` — `importPdf`, normalização, `save()`
- `src/components/events/EventCard.tsx` — exibir mais campos importados
- `src/components/events/types.ts` — defaults + helper `normalizeEventFromAI`

Sem alterações de banco — todos os campos já existem na tabela `school_events`.

---

## Resultado esperado

Após aplicar: ao importar uma ata em PDF, **todos os campos extraíveis aparecem** no formulário e no card (enfoque, metas, pontos de atenção, contagem de ações/procedimentos, responsáveis, datas, tags, status). O usuário vê claramente o que foi importado e o que ficou vazio.
