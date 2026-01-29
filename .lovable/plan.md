

# Plano: Ajustar Formatação do PDF de Exportação

## Visão Geral

Melhorar a legibilidade do PDF exportado aumentando a fonte e aplicando negrito nos nomes de turmas e disciplinas, além de abreviar nomes de disciplinas longas para melhor aproveitamento do espaço.

---

## Alterações no Arquivo: `src/pages/mapping/MappingSummary.tsx`

### 1. Adicionar Mapa de Abreviações

Criar um objeto constante com as abreviações das disciplinas:

```tsx
const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  'Aprofundamento I': 'Aprof. I',
  'Aprofundamento II': 'Aprof. II',
  'Educação Digital': 'Ed. Dig',
  'Educação Física': 'Ed. Fís',
  'Eletiva de Base': 'Eletiva',
  'Identidade e Protagonismo': 'Id. Prot',
  'Letramento em Matemática': 'Let. M',
  'Letramento em Português': 'Let. P',
  'Língua Inglesa': 'Inglês'
};

const abbreviateSubject = (name: string): string => {
  return SUBJECT_ABBREVIATIONS[name] || name;
};
```

### 2. Aplicar Abreviações na Preparação dos Dados

Modificar a função `preparePreviewData` para usar as abreviações nos headers:

```tsx
const headers = ['Turma', ...subjectList.map(abbreviateSubject)];
```

### 3. Ajustar Estilos do PDF

Modificar a função `generatePDF` para aumentar fontes e aplicar negrito:

```tsx
autoTable(doc, {
  startY: 28,
  head: [shiftData.headers],
  body: shiftData.rows,
  theme: 'grid',
  headStyles: { 
    fillColor: [59, 130, 246],
    fontSize: 9,           // Aumentar de 8 para 9
    fontStyle: 'bold'      // Manter negrito no header
  },
  bodyStyles: { 
    fontSize: 8            // Aumentar de 7 para 8
  },
  columnStyles: {
    0: { 
      fontStyle: 'bold', 
      cellWidth: 25,
      fontSize: 10         // Fonte maior para turmas
    }
  }
});
```

---

## Mapa de Abreviações

| Nome Original | Abreviação |
|--------------|------------|
| Aprofundamento I | Aprof. I |
| Aprofundamento II | Aprof. II |
| Educação Digital | Ed. Dig |
| Educação Física | Ed. Fís |
| Eletiva de Base | Eletiva |
| Identidade e Protagonismo | Id. Prot |
| Letramento em Matemática | Let. M |
| Letramento em Português | Let. P |
| Língua Inglesa | Inglês |

---

## Resumo das Mudanças de Fonte

| Elemento | Antes | Depois |
|----------|-------|--------|
| Header (disciplinas) | fontSize: 8 | fontSize: 9, fontStyle: bold |
| Body (conteúdo) | fontSize: 7 | fontSize: 8 |
| Coluna Turma | fontSize: 7, bold | fontSize: 10, bold |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingSummary.tsx` | Adicionar abreviações e ajustar estilos de fonte |

