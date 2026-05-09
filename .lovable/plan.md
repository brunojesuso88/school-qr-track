## Reestruturar projetos com nova estrutura institucional

Substituir os tópicos atuais (Enfoque, Metas, Pontos de atenção, Ações, Procedimentos, Responsáveis) pelos 9 tópicos solicitados, mantendo a Identificação como cabeçalho do projeto.

### 1. Banco de dados (`school_events`)
Adicionar colunas novas (nullable, sem quebrar registros existentes):

- `justificativa` text
- `objetivo_geral` text
- `objetivos_especificos` jsonb (array de strings)
- `metodologia` text
- `cronograma` jsonb (array de `{ etapa: string, periodo: string }`)
- `recursos` jsonb (array de strings)
- `culminancia` text
- `avaliacao` text

As colunas antigas (`enfoque`, `metas`, `pontos_atencao`, `acoes_estrategicas`, `procedimentos`, `responsaveis`) **permanecem na tabela** para preservar projetos já cadastrados, mas deixam de ser editáveis/exibidas. Apenas `acoes_estrategicas` continua sendo usado, agora rotulado como **"4. Plano estratégico do projeto"** (mesma semântica de lista de ações).

### 2. Tipos (`src/components/events/types.ts`)

- Adicionar os novos campos em `SchoolEvent` e `emptyEvent`.
- Remover dos formulários (mas não do tipo) os campos legados não utilizados; o tipo manterá os legados como opcionais para compatibilidade de leitura.
- Atualizar `normalizeEventFromAI` e `FILLABLE_KEYS` para refletir os novos campos.

### 3. Formulário (`EventFormDialog.tsx`)
Reorganizar abas:

- **Identificação** — Título, status, datas/contínuo, responsáveis (movido para cá), tags, resumo institucional.
- **Conteúdo** — 1. Justificativa, 2. Objetivo geral, 3. Objetivos específicos (lista), 5. Metodologia.
- **Execução** — 4. Plano estratégico (lista, reaproveita `acoes_estrategicas`), 6. Cronograma (lista de etapa + período), 7. Recursos necessários (lista), 8. Culminância, 9. Avaliação.
- **Mídia** — capa + imagens + PDF (sem mudanças).

Botões de IA por campo (`event-ai-suggest`) atualizados para os novos nomes de campo.

### 4. Modal de detalhes (`EventDetailDialog.tsx`)
Renderizar as novas seções na ordem:

1. Justificativa, 2. Objetivo geral, 3. Objetivos específicos (bullets), 4. Plano estratégico (bullets), 5. Metodologia, 6. Cronograma (lista etapa — período), 7. Recursos necessários (bullets), 8. Culminância, 9. Avaliação.

Cabeçalho continua com título, status, período, tags, responsáveis e resumo.

### 5. Exportação PDF (`Events.tsx`)
Reescrever o corpo do PDF abaixo do cabeçalho institucional (que já tem logo CEPANS) para emitir:

```
PROJETO: <título>
IDENTIFICAÇÃO DO PROJETO
  - Status, Período, Responsáveis, Tags, Resumo
1. JUSTIFICATIVA
2. OBJETIVO GERAL
3. OBJETIVOS ESPECÍFICOS  (• item)
4. PLANO ESTRATÉGICO DO PROJETO  (• item)
5. METODOLOGIA
6. CRONOGRAMA  (• etapa — período)
7. RECURSOS NECESSÁRIOS  (• item)
8. CULMINÂNCIA
9. AVALIAÇÃO
```

### 6. Edge Functions de IA
Atualizar prompts e schemas em:

- `supabase/functions/event-ai-fill/index.ts` — `eventSchema` passa a exigir `justificativa`, `objetivo_geral`, `objetivos_especificos`, `metodologia`, `cronograma`, `recursos`, `culminancia`, `avaliacao` (mantendo `acoes_estrategicas` para o plano estratégico). Instrução do sistema atualizada para gerar conteúdo institucional nesses 9 tópicos.
- `supabase/functions/event-ai-suggest/index.ts` — mapear os novos nomes de campo para sugestões.
- `supabase/functions/parse-event-pdf/index.ts` — schema/prompt de extração PDF passa a buscar os novos campos.

### 7. Card (`EventCard.tsx`)
Sem mudança estrutural. Apenas garantir que continua exibindo título, status, período, resumo e tags (campos que se mantêm).

### Fora do escopo
- Não migrar dados antigos para os novos campos automaticamente (projetos antigos abrirão com seções novas em branco; usuário pode preencher ou usar IA).
- Não remover colunas antigas do banco.
- Sem mudanças em rotas, RLS ou storage.
