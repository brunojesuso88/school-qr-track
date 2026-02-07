

# Plano: Mostrar Apenas Professores Disponíveis no Popover dos Dias

## O que sera feito

Ajustar o popover de disponibilidade nos cabecalhos dos dias da semana na grade de horario para exibir **somente** os professores disponiveis em cada periodo, removendo a listagem de professores indisponiveis (texto riscado/cinza).

## Alteracao

### `src/components/timetable/TimetableGrid.tsx`

Remover o bloco que renderiza professores indisponiveis e ajustar a verificacao de "nenhum professor":

**Antes:** Exibe professores disponiveis com bolinha colorida E indisponiveis com texto riscado/cinza.

**Depois:** Exibe apenas professores disponiveis. Se nenhum estiver disponivel, mostra "Nenhum professor disponivel".

Trecho afetado (linhas 131-156): remover as linhas 148-153 (bloco `unavailable.map`) e ajustar a condicao de vazio para verificar apenas `available.length === 0`.

## Detalhes Tecnicos

```
// Remover a variavel `unavailable` (nao sera mais usada)
// Mudar condicao de vazio:
//   ANTES: available.length === 0 && unavailable.length === 0
//   DEPOIS: available.length === 0
// Mudar mensagem: "Nenhum professor cadastrado" -> "Nenhum professor disponivel"
// Remover bloco unavailable.map(...)
```

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/timetable/TimetableGrid.tsx` | Remover listagem de professores indisponiveis do popover, manter apenas disponiveis |
