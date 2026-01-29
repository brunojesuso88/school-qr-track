

# Plano: Melhorias no Mapeamento Escolar

## Resumo das Alterações

1. **Associar Disciplina**: Adicionar filtro por turma e possibilidade de cancelar atribuição
2. **Distribuição**: Corrigir scroll do mouse no Popover de atribuição
3. **Resumo**: Adicionar exportação do mapeamento em formato tabular com páginas por turno

---

## 1. Associar Disciplina - Filtro por Turma e Cancelar Atribuição

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**Adicionar estado de filtro:**
```tsx
const [classFilter, setClassFilter] = useState<string>("");
```

**Adicionar Select de filtro no header:**
Um dropdown para selecionar uma turma específica, filtrando a exibição apenas para as disciplinas dessa turma.

**Atualizar renderização:**
- Filtrar turmas exibidas com base no `classFilter`
- O filtro mostra "Todas as turmas" por padrão

A funcionalidade de cancelar atribuição (Remover) já foi implementada anteriormente neste diálogo.

---

## 2. Distribuição - Corrigir Scroll do Mouse no Popover

### Arquivo: `src/pages/mapping/MappingDistribution.tsx`

**Problema identificado:**
O `Popover` que abre para selecionar professores (linhas 323-408) contém um `ScrollArea` interno. O problema é que o scroll do mouse pode estar sendo bloqueado pelo componente pai.

**Solução:**
Adicionar propriedades ao `ScrollArea` interno do Popover para garantir que eventos de scroll não sejam propagados:

```tsx
<PopoverContent 
  className="w-80 p-0" 
  align="end"
  onWheel={(e) => e.stopPropagation()}
>
```

E também garantir que o `ScrollArea` tenha altura fixa correta sem `flex`:
```tsx
<ScrollArea className="h-[250px]">
```

---

## 3. Resumo - Exportação do Mapeamento

### Arquivo: `src/pages/mapping/MappingSummary.tsx`

**Adicionar funcionalidade de exportação CSV com formato tabular:**

- **Estrutura do CSV:**
  - 1ª coluna: Nome da turma
  - 1ª linha: Nomes das disciplinas
  - Células: Nome do professor + número de aulas (ex: "Maria Silva (4)")

- **Páginas separadas por turno:**
  - 3 arquivos CSV separados (manhã, tarde, noite) ou
  - 1 arquivo com separadores claros entre turnos

**Estrutura do código:**

```tsx
const exportMapping = async () => {
  setExporting(true);
  try {
    const shifts = ['morning', 'afternoon', 'evening'];
    
    for (const shift of shifts) {
      const shiftClasses = classes.filter(c => c.shift === shift);
      if (shiftClasses.length === 0) continue;
      
      // Obter todas as disciplinas únicas deste turno
      const shiftSubjects = new Set<string>();
      shiftClasses.forEach(c => {
        classSubjects
          .filter(cs => cs.class_id === c.id)
          .forEach(cs => shiftSubjects.add(cs.subject_name));
      });
      
      const subjectList = Array.from(shiftSubjects).sort();
      
      // Header: vazio + nomes das disciplinas
      const header = ['Turma', ...subjectList];
      
      // Linhas: nome da turma + professor(aulas) para cada disciplina
      const rows = shiftClasses.map(c => {
        const row = [c.name];
        subjectList.forEach(subjectName => {
          const cs = classSubjects.find(
            x => x.class_id === c.id && x.subject_name === subjectName
          );
          if (cs) {
            const teacher = teachers.find(t => t.id === cs.teacher_id);
            row.push(teacher 
              ? `${teacher.name} (${cs.weekly_classes})` 
              : `- (${cs.weekly_classes})`
            );
          } else {
            row.push('-');
          }
        });
        return row;
      });
      
      const csv = [header, ...rows].map(r => r.join(';')).join('\n');
      downloadCSV(csv, `mapeamento_${SHIFT_LABELS[shift]}_${date}.csv`);
    }
    
    toast.success('Mapeamento exportado!');
  } finally {
    setExporting(false);
  }
};
```

**UI de exportação:**
Adicionar um `Card` ou botão no topo da página de Resumo com a opção de exportar.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/mapping/TeacherAssociationDialog.tsx` | Adicionar filtro por turma |
| `src/pages/mapping/MappingDistribution.tsx` | Corrigir scroll no Popover |
| `src/pages/mapping/MappingSummary.tsx` | Adicionar exportação do mapeamento |

---

## Formato do CSV Exportado

```text
Exemplo - mapeamento_Manhã_2026-01-29.csv:

Turma;Português;Matemática;História;Geografia;Ciências
1º Ano A;Maria Silva (4);João Costa (4);Ana Lima (2);- (2);Pedro Santos (3)
1º Ano B;Maria Silva (4);Carlos Souza (4);Ana Lima (2);Paulo Reis (2);Pedro Santos (3)
2º Ano A;Fernanda Cruz (4);João Costa (4);- (2);Paulo Reis (2);Lucia Alves (3)
```

Cada turno gera um arquivo separado para facilitar a visualização e impressão.

