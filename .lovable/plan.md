
# Plano: Ajustar Formatação do PDF de Exportação

## Visão Geral

Ajustar a formatação do PDF para que os nomes dos professores fiquem em uma única linha e os nomes das disciplinas possam quebrar em 2 linhas centralizadas. Também corrigir as abreviações conforme solicitado.

---

## Alterações no Arquivo: `src/pages/mapping/MappingSummary.tsx`

### 1. Corrigir Mapa de Abreviações (linhas 31-41)

Atualizar as abreviações conforme solicitado:

| Nome Original | Abreviação Atual | Nova Abreviação |
|--------------|------------------|-----------------|
| Aprofundamento II | Aprof. II | Aprof II |
| Letramento em Matemática | Let. M | Let. Mat |
| Letramento em Português | Let. P | Let. Port |

```tsx
const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  'Aprofundamento I': 'Aprof I',
  'Aprofundamento II': 'Aprof II',
  'Educação Digital': 'Ed. Dig',
  'Educação Física': 'Ed. Fís',
  'Eletiva de Base': 'Eletiva',
  'Identidade e Protagonismo': 'Id. Prot',
  'Letramento em Matemática': 'Let. Mat',
  'Letramento em Português': 'Let. Port',
  'Língua Inglesa': 'Inglês'
};
```

### 2. Ajustar Estilos do PDF (linhas 152-168)

Modificar a configuração do `autoTable` para:
- **Headers (disciplinas)**: Texto centralizado com quebra de linha permitida
- **Body (professores)**: Texto em uma única linha com `cellWidth: 'auto'` e `overflow: 'ellipsize'` ou largura mínima adequada

```tsx
autoTable(doc, {
  startY: 28,
  head: [shiftData.headers],
  body: shiftData.rows,
  theme: 'grid',
  headStyles: { 
    fillColor: [59, 130, 246],
    fontSize: 9,
    fontStyle: 'bold',
    halign: 'center',    // Centralizar headers
    valign: 'middle'     // Alinhar verticalmente ao meio
  },
  bodyStyles: { 
    fontSize: 8,
    cellPadding: 2,
    overflow: 'linebreak',  // Permitir quebra de linha se necessário
    minCellWidth: 20        // Largura mínima para evitar quebra excessiva
  },
  columnStyles: {
    0: { fontStyle: 'bold', cellWidth: 25, fontSize: 10 }
  },
  styles: {
    cellPadding: 2,
    valign: 'middle'
  }
});
```

---

## Resumo das Alterações

| Item | Alteração |
|------|-----------|
| Abreviações | Aprof. I/II → Aprof I/II, Let. M → Let. Mat, Let. P → Let. Port |
| Headers | Centralizado horizontal e verticalmente |
| Células do body | Largura mínima para manter professores em uma linha |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingSummary.tsx` | Corrigir abreviações e ajustar estilos do autoTable |
