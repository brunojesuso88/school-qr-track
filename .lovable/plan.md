

# Plano: Bloquear Frequencia no Final de Semana + Remover Relatorio

## 1. Bloquear frequencia diaria nos finais de semana (Classes.tsx)

**Arquivo**: `src/pages/Classes.tsx`

- Verificar se `new Date().getDay()` e 0 (domingo) ou 6 (sabado)
- Se for final de semana:
  - Desabilitar o botao "Frequencia Diaria" em todos os cards
  - Mudar o texto/badge para "Frequencia indisponivel: final de semana"
  - Mudar a cor do badge de status para cinza/neutro
  - Impedir abertura do `ClassAttendanceDialog`

**Arquivo**: `src/components/ClassAttendanceDialog.tsx`

- Adicionar verificacao de seguranca: se for final de semana, mostrar toast de erro e nao abrir/salvar

## 2. Remover "Relatorio de Frequencia" da aba Frequencia

**Arquivo**: `src/pages/Attendance.tsx`

- Remover o Card "Relatorio de Frequencia" (linhas 862-976) que contem a tabela de alunos com presencas/faltas/percentual e acoes de exportar/excluir
- Remover a funcao `generatePDF` e `handleDeleteAttendance` se ficarem orfas (verificar se sao usadas em outro lugar)
- Manter os "Registros Individuais" e o "Calendario de Frequencia Diaria"

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Classes.tsx` | Desabilitar frequencia diaria nos finais de semana |
| `src/components/ClassAttendanceDialog.tsx` | Seguranca extra contra registro no fim de semana |
| `src/pages/Attendance.tsx` | Remover card "Relatorio de Frequencia" |

