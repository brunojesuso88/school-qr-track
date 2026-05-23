## Ajustes no Sistema AEE — Aba PEI

### 1. Expandir sugestões do PEI (+20 por tópico)

Adicionar 20 novas sugestões em cada constante de `src/components/aee/peiSuggestions.ts`, mantendo as existentes. Conteúdo baseado em referências de Educação Especial (BNCC, Política Nacional de Educação Especial, materiais do MEC, AEE/SRM, manuais de neuropsicopedagogia e práticas de altas habilidades/superdotação).

**Tópico 2 — Perfil Funcional de Aprendizagem** (`FUNCTIONAL_PROFILE_SUGGESTIONS`)
+20 itens cobrindo: estilos cognitivos (sequencial/global), nível de iniciativa, regulação emocional, tempo de resposta, preferência por trabalho individual/grupo, uso funcional da linguagem escrita, percepção visuoespacial, organização de materiais, compreensão de instruções multi-etapa, autoavaliação, persistência diante de erros, etc.

**Tópico 3 — Potencialidades** (`POTENTIALITIES_SUGGESTIONS`)
+20 itens incluindo: habilidades esportivas, oralidade e argumentação, sensibilidade musical/rítmica, raciocínio espacial, capacidade de imitação funcional, interesses por animais/natureza, habilidades culinárias, organização visual, talento para mediação de conflitos, habilidades digitais (apps, vídeos), expressão corporal, etc.

**Tópico 4 — Barreiras de Aprendizagem** (`LEARNING_BARRIERS_SUGGESTIONS`)
+20 itens incluindo: discalculia funcional, disgrafia, dificuldade em sequência temporal, hiperfoco em interesses restritos, evitação seletiva de disciplinas, dificuldades em provas cronometradas, lentidão na cópia, dependência excessiva do mediador, dificuldade com transições, fadiga sensorial vespertina, dificuldade em automonitoramento, etc.

**Tópico 7 — Plano de Intervenção Pedagógica** (`INTERVENTION_PLAN_SUGGESTIONS`)
+20 objetivos estruturados (objetivo/estratégia/frequência/responsável/recurso), cobrindo: consciência fonológica, funções executivas, regulação emocional (técnica do semáforo), tutoria entre pares, ensino estruturado TEACCH, rotinas visuais, treino de habilidades sociais (PEHS), uso de tecnologia assistiva, mediação Feuerstein, projetos PBL para altas habilidades, mentoria acadêmica, enriquecimento Renzulli, etc.

**Tópico 8 — Adaptações por Disciplina**
Distribuir +20 itens entre as três constantes (`ADAPTATION_PORTUGUES_HUMANAS_SUGGESTIONS`, `ADAPTATION_MATEMATICA_EXATAS_SUGGESTIONS`, `ADAPTATION_CIENCIAS_HUMANAS_SUGGESTIONS`) e `ADAPTATION_HIGH_ABILITIES_SUGGESTIONS` — ~5 novos itens em cada, totalizando 20. Exemplos: textos com símbolos pictográficos (ARASAAC), reconto oral, software de leitura imersiva, manipuláveis matemáticos virtuais (Geogebra), tabela pitagórica, modelos 3D anatômicos, experimentos práticos com roteiro ilustrado, debates estruturados, etc.

**Tópico 9 — Avaliação e Critérios** (`EVALUATION_CRITERIA_SUGGESTIONS`)
+20 itens incluindo: rubricas individualizadas, avaliação por evidências (vídeos/áudios), prova em duas etapas, recuperação contínua, avaliação por projetos para altas habilidades, autoavaliação guiada, avaliação entre pares, ledor/escriba, prova em Libras, ampliação Braille, redução do peso de erros ortográficos, contextos avaliativos lúdicos, etc.

### 2. Indicador visual de Status do Projeto (Plano de Intervenção)

Em `src/components/aee/PEIForm.tsx`, na seção de **Plano de Intervenção** (cards de projeto/objetivo), adicionar um ícone grande (≈48–64px) no canto superior esquerdo de cada card indicando o status:

- **Concluído** → ícone de check verde (Lucide `CheckCircle2` em `text-green-500`)
- **Em Andamento** → ícone animado de progresso (Lucide `Loader2` com `animate-spin` em `text-amber-500`, ou barra `Progress` indeterminada)
- **Planejado** → ícone de ampulheta/relógio (Lucide `Hourglass` em `text-slate-400`)

Se o campo `status` ainda não existir no modelo de cada item do plano de intervenção, adicionar:
- Campo `status: 'planejado' | 'andamento' | 'concluido'` (default `'planejado'`)
- Seletor (Select ou ToggleGroup) no formulário para alternar o status
- Persistência no JSON do PEI (já armazenado em `student_pei`, sem migração necessária)

Layout do card: `relative` com o ícone posicionado `absolute top-3 left-3`, e o conteúdo do card recebendo `pl-16` para não sobrepor.

### Arquivos a alterar
- `src/components/aee/peiSuggestions.ts` — expandir todas as constantes listadas.
- `src/components/aee/PEIForm.tsx` — renderizar indicador de status, adicionar seletor de status, ajustar layout dos cards de intervenção.

### Fora de escopo
- Alterações de banco (status fica no JSON do PEI já existente).
- Alterações em outras abas além de PEI.
