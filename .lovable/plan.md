
# Plano: Niveis de Geracao + Chat de Resolucao de Conflitos com IA

## Resumo

Adicionar 3 niveis de geracao de horario (Leve, Moderada, Rigorosa) na pagina "Gerar" e criar uma area de chat interativo com IA para resolucao de conflitos. O projeto ja usa Lovable AI (gateway), entao nao e necessario integrar API KEY da OpenAI -- o sistema ja possui essa capacidade via Lovable AI.

---

## 1. Niveis de Geracao de Horario

### O que muda na UI (`src/pages/timetable/TimetableGenerate.tsx`)

Adicionar um novo Card "Nivel de Geracao" entre a selecao de turmas e o botao de gerar, com 3 opcoes visuais:

- **Leve** (icone verde): Geracao rapida focada em viabilidade. Evita conflitos basicos, garante carga horaria, permite janelas.
- **Moderada** (icone amarelo): Equilibrio entre qualidade e viabilidade. Distribuicao equilibrada, limita aulas consecutivas, respeita disponibilidade, reduz janelas.
- **Rigorosa** (icone vermelho): Otimizacao maxima. Sequencia pedagogica ideal, minimiza janelas, limite rigido de consecutivas, preferencias obrigatorias, otimizacao global.

Cada nivel sera um card clicavel com radio-button visual. O nivel selecionado sera enviado como parametro `generationLevel` para a edge function.

### Estado novo
```
const [generationLevel, setGenerationLevel] = useState<'light' | 'moderate' | 'strict'>('moderate');
```

### O que muda na Edge Function (`supabase/functions/generate-timetable/index.ts`)

Receber o parametro `generationLevel` do body e ajustar o prompt da IA de acordo:

- **light**: Prompt simples focado apenas em evitar conflitos de professor/turma e garantir carga horaria total. `temperature: 0.5`
- **moderate**: Prompt com regras pedagogicas de distribuicao, limites de consecutivas, balanceamento. `temperature: 0.3` (atual)
- **strict**: Prompt detalhado com todas as regras + otimizacao global + sequencia pedagogica + minimizacao de janelas. `temperature: 0.1`, modelo `google/gemini-2.5-pro` (mais potente)

### O que muda no Context (`src/contexts/TimetableContext.tsx`)

Atualizar a assinatura de `generateTimetable` para aceitar o nivel:
```
generateTimetable: (classIds: string[], level?: string) => Promise<...>
```

---

## 2. Chat Interativo para Resolucao de Conflitos

### Nova Edge Function: `supabase/functions/conflict-chat/index.ts`

Uma edge function dedicada ao chat de resolucao de conflitos que:
- Recebe o historico de mensagens do usuario + contexto dos conflitos atuais
- Envia para o Lovable AI com um system prompt especializado em resolucao de conflitos de horarios escolares
- Retorna resposta em streaming (SSE) para exibicao em tempo real
- O system prompt inclui: dados dos professores, turmas, entradas atuais e conflitos detectados

### Novo Componente: `src/components/timetable/ConflictChat.tsx`

Um componente de chat embutido na pagina de Visao Geral do horario (`src/pages/Timetable.tsx`), acessivel por um botao flutuante ou dentro do ConflictAlert:

- Interface de chat com historico de mensagens
- Campo de input para o usuario digitar perguntas/solicitacoes
- Streaming de resposta token por token
- Renderizacao com markdown (react-markdown ja disponivel via dependencias)
- Contexto automatico: ao abrir, envia automaticamente os conflitos atuais como contexto
- Sugestoes rapidas pre-definidas (botoes): "Como resolver os conflitos?", "Quais professores estao sobrecarregados?", "Sugerir redistribuicao"

### Integracao na UI

- No `ConflictAlert.tsx`: substituir o botao "Sugestoes" atual por "Chat com IA" que abre o componente de chat
- O chat abre em um Dialog/Sheet lateral
- O usuario pode fazer perguntas livres sobre seus conflitos e receber orientacoes detalhadas

---

## 3. Nota sobre API KEY da OpenAI

O projeto ja utiliza o Lovable AI Gateway que oferece acesso a modelos de IA (incluindo modelos equivalentes ao OpenAI) sem necessidade de API key adicional. O `LOVABLE_API_KEY` ja esta configurado automaticamente. Portanto, **nao e necessario adicionar uma integracao separada com API key da OpenAI** -- toda a funcionalidade de IA ja esta coberta.

---

## Arquivos Alterados/Criados

| Arquivo | Acao |
|---------|------|
| `src/pages/timetable/TimetableGenerate.tsx` | Adicionar card de selecao de nivel de geracao |
| `src/contexts/TimetableContext.tsx` | Atualizar `generateTimetable` para receber `level` |
| `supabase/functions/generate-timetable/index.ts` | Receber `generationLevel` e ajustar prompt/modelo por nivel |
| `supabase/functions/conflict-chat/index.ts` | **NOVO** - Edge function de chat com streaming para resolucao de conflitos |
| `src/components/timetable/ConflictChat.tsx` | **NOVO** - Componente de chat interativo com IA |
| `src/components/timetable/ConflictAlert.tsx` | Substituir botao "Sugestoes" por "Chat com IA" |
| `supabase/config.toml` | Adicionar configuracao da nova function `conflict-chat` |

---

## Detalhes Tecnicos

### Prompts por Nivel (Edge Function)

**Leve:**
```
Crie um horario BASICO. Regras:
1. Evitar conflitos de professor (mesmo professor, mesmo horario)
2. Evitar conflitos de turma (mesma turma, mesmo horario)  
3. Garantir carga horaria total de cada disciplina
Nao se preocupe com distribuicao pedagogica ou janelas.
```

**Moderada (atual, melhorado):**
```
Crie um horario EQUILIBRADO. Regras:
1-3 da Leve +
4. Distribuir disciplinas ao longo da semana (evitar mesma disciplina em dias consecutivos)
5. Limitar a 2 aulas consecutivas da mesma disciplina
6. Respeitar disponibilidade dos professores
7. Reduzir janelas (horarios vazios entre aulas)
8. Balancear carga diaria (distribuir uniformemente)
```

**Rigorosa:**
```
Crie o MELHOR horario possivel. Regras:
1-8 da Moderada +
9. Sequencia pedagogica: disciplinas exatas no inicio do dia, praticas no fim
10. ZERO janelas para professores
11. Maximo 1 aula consecutiva da mesma disciplina (exceto se necessario)
12. Preferencias obrigatorias de professores devem ser 100% respeitadas
13. Otimizacao global: minimizar deslocamentos e maximizar aproveitamento
```

### Chat Streaming (conflict-chat)

- Usa o padrao SSE documentado no Lovable AI
- System prompt inclui dados em tempo real (buscados do banco)
- Frontend usa `fetch` com `ReadableStream` para processar tokens
- Tratamento de erros 429 (rate limit) e 402 (creditos)
