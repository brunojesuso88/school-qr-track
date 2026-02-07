

# Plano: Correcoes na Geracao de Horario por Grupo de Turmas

## Problemas Encontrados

### Problema 1 (CRITICO): max_tokens insuficiente para grupos grandes
A edge function usa `max_tokens: 8000`. Cada turma gera ~30 entradas JSON, e cada entrada ocupa ~120 tokens. Para o turno da manha (7 turmas x 30 aulas = 210 entradas), sao necessarios ~25.000 tokens. A resposta da IA e truncada, o JSON fica incompleto, e o parse falha com "Erro ao processar resposta da IA".

**Solucao:** Aumentar `max_tokens` para 32000 e, como seguranca adicional, gerar turma por turma dentro da edge function (loop), concatenando os resultados. Isso garante que mesmo com muitas turmas, cada chamada individual cabe no limite.

### Problema 2 (CRITICO): Conflitos entre turmas nao-selecionadas
Quando o usuario gera horario para um grupo (ex: so MM100 e MM101), a edge function nao consulta as entradas existentes das OUTRAS turmas. Se o professor X ja tem aula na MM102 no 1o horario de segunda, a IA nao sabe disso e pode alocar o mesmo professor no mesmo horario para MM100, criando conflito.

**Solucao:** Na edge function, buscar TODAS as entradas existentes (nao apenas das turmas selecionadas) para construir o mapa de slots ocupados por professor. Passar esses slots como restricao para a IA.

### Problema 3 (MEDIO): Duplicacao de delecao
O frontend (`handleGenerate`) faz `clearEntries(classId)` para cada turma antes de chamar a edge function. A edge function TAMBEM deleta entradas nao-travadas das mesmas turmas (linha 430-434). Isso e redundante e causa uma janela onde as entradas ja foram deletadas pelo frontend antes da IA gerar novas.

**Solucao:** Remover a delecao no frontend (`handleGenerate`), deixando apenas a edge function responsavel por limpar e inserir.

### Problema 4 (MEDIO): Prerequisito de disponibilidade enganoso
O card de pre-requisitos mostra "X professores com disponibilidade configurada" mas usa `teachersWithAvailability = teachers` (linha 35), ou seja, mostra TODOS os professores como se tivessem disponibilidade, mesmo que nenhum tenha configurado.

**Solucao:** Buscar dados reais de `teacher_availability` e contar apenas professores que realmente tem registros.

---

## Alteracoes Planejadas

### 1. `supabase/functions/generate-timetable/index.ts`

**a) Buscar entradas de TODAS as turmas para evitar conflitos entre professores:**
```typescript
// ANTES (linha 245):
supabase.from('timetable_entries').select('*').in('class_id', classIds)

// DEPOIS:
supabase.from('timetable_entries').select('*')
```
E adicionar ao mapa de slots ocupados as entradas de turmas NAO selecionadas (para que a IA saiba que aqueles horarios de professor estao tomados).

**b) Gerar turma por turma em loop (evitar estouro de tokens):**
Em vez de enviar todas as turmas num unico prompt, iterar sobre cada turma individualmente:
- Para cada turma, montar o prompt com as disciplinas daquela turma
- Incluir no prompt os slots ja ocupados (de turmas anteriores + entradas existentes)
- Acumular os resultados
- Atualizar os slots ocupados apos cada geracao

**c) Aumentar max_tokens para 16000** (suficiente para 1 turma com 30 aulas).

**d) Adicionar explicacao no prompt sobre slots ocupados por professor em outras turmas.**

### 2. `src/pages/timetable/TimetableGenerate.tsx`

**a) Remover delecao duplicada no frontend:**
```typescript
// REMOVER linhas 91-93:
for (const classId of classIds) {
  await clearEntries(classId);
}
```

**b) Corrigir prerequisito de disponibilidade:**
```typescript
// ANTES:
const teachersWithAvailability = teachers;

// DEPOIS:
// Buscar contagem real de professores com disponibilidade configurada
```
Adicionar um `useMemo` que consulta `teacherAvailability` do TimetableContext para contar professores com registros reais.

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/generate-timetable/index.ts` | Gerar turma por turma em loop; buscar entradas de todas as turmas para evitar conflitos; ajustar max_tokens |
| `src/pages/timetable/TimetableGenerate.tsx` | Remover delecao duplicada; corrigir contagem de disponibilidade |

