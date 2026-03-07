

# Plano: Filtro de Ocorrencias, Remover Notificacoes, Zoom Foto Turma

## 1. Filtro "Alunos com ocorrencia" na aba Alunos

**Arquivo**: `src/pages/Students.tsx`

- Adicionar estado `filterOccurrences` (boolean, default false)
- Ao montar o componente, buscar todos os `student_id`s distintos da tabela `occurrences` e armazenar em um `Set<string>`
- Adicionar um checkbox/toggle no bloco de filtros: "Alunos com ocorrencia"
- Quando ativado, filtrar `filteredStudents` para mostrar apenas alunos cujo `id` esta no set de ocorrencias
- Ordenar esses alunos pela data da ocorrencia mais recente (buscar tambem a data mais recente por aluno para usar como criterio de ordenacao)

Logica:
```typescript
// Buscar ocorrencias agrupadas
const { data } = await supabase
  .from('occurrences')
  .select('student_id, date')
  .order('date', { ascending: false });

// Map: student_id -> most recent date
const occurrenceMap = new Map<string, string>();
data?.forEach(o => {
  if (!occurrenceMap.has(o.student_id)) occurrenceMap.set(o.student_id, o.date);
});
```

No filtro, quando `filterOccurrences` ativo, filtrar e ordenar por data mais recente.

## 2. Remover "Notificacoes" do sidebar

**Arquivo**: `src/components/DashboardLayout.tsx`

- Remover o item `{ name: 'Notificacoes', href: '/notifications', icon: Bell, roles: [...] }` do array `allNavigation` (linha 34)

## 3. Turmas: Zoom na foto + botao de frequencia no card

**Arquivo**: `src/pages/Classes.tsx`

- **Remover** o `onClick={() => setAttendanceClass(classItem.name)}` do Card (linha 585)
- **Adicionar** ao clicar no card: abrir um dialog/modal com a foto da turma em tamanho grande (zoom), similar ao zoom de foto de aluno. Se nao houver foto, nao abrir nada.
- **Adicionar** um novo botao "Frequencia Diaria" na area de botoes do card:
  - Se `classesWithAttendance.has(classItem.name)` → botao verde com texto "Frequencia Diaria"
  - Senao → botao vermelho com texto "Frequencia Diaria"
  - Ao clicar, abrir o `ClassAttendanceDialog` (setar `attendanceClass`)
- Adicionar estado `zoomPhotoClass` para controlar o modal de zoom da foto da turma

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Students.tsx` | Adicionar filtro "Alunos com ocorrencia" com ordenacao por data |
| `src/components/DashboardLayout.tsx` | Remover item "Notificacoes" do sidebar |
| `src/pages/Classes.tsx` | Card clica para zoom foto; botao colorido de frequencia diaria |

