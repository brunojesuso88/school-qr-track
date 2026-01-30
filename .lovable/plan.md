

# Plano: PDF com 1 Pagina por Turno Dividida em 2 Secoes Horizontais

## Visao Geral

Reorganizar a exportacao do PDF para que cada turno ocupe apenas **1 pagina no sentido paisagem**, com a pagina dividida em **2 secoes horizontais** (metade superior e metade inferior), ajustando o tamanho da fonte para preencher o maximo da folha.

---

## Alteracoes no Arquivo: `src/pages/mapping/MappingSummary.tsx`

### 1. Modificar Interface de Dados (linhas 50-66)

Alterar a estrutura para ter 2 secoes por turno em vez de 2 paginas:

```tsx
interface SectionData {
  headers: string[];
  rows: string[][];
  sectionNumber: number;
}

interface ShiftData {
  shift: string;
  shiftLabel: string;
  sections: SectionData[];  // 2 secoes horizontais na mesma pagina
}
```

---

### 2. Atualizar Funcao preparePreviewData (linhas 75-143)

Manter a divisao das disciplinas em 2 grupos, mas renomear para "secoes" em vez de "paginas":

```tsx
const preparePreviewData = (): PreviewData => {
  const shifts = ['morning', 'afternoon', 'evening'] as const;
  const data: ShiftData[] = [];
  
  for (const shift of shifts) {
    const shiftClasses = classes.filter(c => c.shift === shift);
    if (shiftClasses.length === 0) continue;
    
    // Coletar disciplinas unicas deste turno
    const shiftSubjects = new Set<string>();
    shiftClasses.forEach(c => {
      classSubjects
        .filter(cs => cs.class_id === c.id)
        .forEach(cs => shiftSubjects.add(cs.subject_name));
    });
    
    const subjectList = Array.from(shiftSubjects).sort();
    
    // Dividir disciplinas em 2 grupos (secoes horizontais)
    const midPoint = Math.ceil(subjectList.length / 2);
    const subjectGroups = [
      subjectList.slice(0, midPoint),
      subjectList.slice(midPoint)
    ];
    
    const sections = subjectGroups
      .filter(group => group.length > 0)
      .map((subjectGroup, sectionIndex) => {
        const headers = ['Turma', ...subjectGroup.map(abbreviateSubject)];
        
        const rows = shiftClasses.map(c => {
          const row = [c.name];
          subjectGroup.forEach(subjectName => {
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
        
        return {
          headers,
          rows,
          sectionNumber: sectionIndex + 1
        };
      });
    
    data.push({
      shift,
      shiftLabel: SHIFT_LABELS[shift],
      sections
    });
  }
  
  return {
    shifts: data,
    generatedAt: new Date().toLocaleString('pt-BR')
  };
};
```

---

### 3. Reescrever Funcao generatePDF (linhas 159-222)

Gerar apenas 1 pagina por turno com 2 tabelas empilhadas verticalmente:

```tsx
const generatePDF = () => {
  if (!previewData) return;
  
  setExporting(true);
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();   // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 10;
    const date = new Date().toISOString().split('T')[0];
    let isFirstPage = true;
    
    previewData.shifts.forEach((shiftData) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;
      
      // Titulo do turno
      doc.setFontSize(14);
      doc.text(`Mapeamento Escolar - ${shiftData.shiftLabel}`, margin, 12);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${previewData.generatedAt}`, margin, 18);
      
      const numSections = shiftData.sections.length;
      const headerHeight = 22;
      const availableHeight = pageHeight - headerHeight - margin;
      const sectionHeight = availableHeight / numSections;
      
      shiftData.sections.forEach((section, sectionIndex) => {
        const sectionStartY = headerHeight + (sectionIndex * sectionHeight);
        
        // Calcular tamanho da fonte dinamicamente
        const numRows = section.rows.length;
        const numCols = section.headers.length;
        
        // Ajustar fonte baseado na quantidade de dados
        let headerFontSize = 9;
        let bodyFontSize = 8;
        let cellPadding = 2;
        
        // Se tiver muitas linhas, reduzir fonte
        if (numRows > 10) {
          headerFontSize = 8;
          bodyFontSize = 7;
          cellPadding = 1.5;
        }
        if (numRows > 15) {
          headerFontSize = 7;
          bodyFontSize = 6;
          cellPadding = 1;
        }
        
        // Calcular largura das colunas
        const tableWidth = pageWidth - (margin * 2);
        const firstColWidth = 20;
        const otherColWidth = (tableWidth - firstColWidth) / (numCols - 1);
        
        autoTable(doc, {
          startY: sectionStartY,
          head: [section.headers],
          body: section.rows,
          theme: 'grid',
          tableWidth: tableWidth,
          margin: { left: margin, right: margin },
          headStyles: { 
            fillColor: [59, 130, 246],
            fontSize: headerFontSize,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: cellPadding
          },
          bodyStyles: { 
            fontSize: bodyFontSize,
            cellPadding: cellPadding,
            halign: 'center',
            valign: 'middle'
          },
          columnStyles: {
            0: { 
              fontStyle: 'bold', 
              cellWidth: firstColWidth, 
              fontSize: headerFontSize,
              halign: 'left'
            }
          },
          styles: {
            cellPadding: cellPadding,
            valign: 'middle',
            overflow: 'linebreak'
          },
          // Limitar altura da tabela para caber na secao
          didDrawPage: () => {}
        });
      });
    });
    
    doc.save(`mapeamento_escolar_${date}.pdf`);
    setIsPreviewOpen(false);
    toast({ title: "PDF exportado", description: "Arquivo salvo com sucesso." });
  } catch (error: any) {
    toast({ 
      title: "Erro na exportacao", 
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setExporting(false);
  }
};
```

---

### 4. Atualizar Preview Dialog (linhas 516-562)

Atualizar labels de "Pagina" para "Secao" e mostrar ambas secoes juntas:

```tsx
{previewData?.shifts.map((shiftData, idx) => (
  <div key={shiftData.shift} className={idx > 0 ? "mt-6" : ""}>
    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
      <Badge>{shiftData.shiftLabel}</Badge>
      <span className="text-sm text-muted-foreground font-normal">
        (1 pagina com {shiftData.sections.length} secao(oes))
      </span>
    </h3>
    
    {shiftData.sections.map((section, sectionIdx) => (
      <div key={sectionIdx} className={sectionIdx > 0 ? "mt-4" : ""}>
        <p className="text-sm text-muted-foreground mb-2">
          Secao {section.sectionNumber} - {section.headers.length - 1} disciplina(s)
        </p>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {section.headers.map((h, i) => (
                  <TableHead 
                    key={i} 
                    className={i === 0 ? "font-bold bg-muted" : "text-xs text-center"}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <TableCell 
                      key={cellIdx}
                      className={cellIdx === 0 ? "font-medium" : "text-xs text-center"}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    ))}
  </div>
))}
```

---

## Resumo das Alteracoes

| Alteracao | Descricao |
|-----------|-----------|
| Estrutura de dados | Renomear `pages` para `sections` (secoes) |
| Geracao do PDF | 1 pagina por turno com 2 tabelas empilhadas verticalmente |
| Tamanho de fonte | Dinamico baseado na quantidade de linhas e colunas |
| Espacamento | Reduzido para preencher mais a folha |
| Preview | Atualizar labels para "Secao" em vez de "Pagina" |

---

## Layout Visual do PDF

```text
+--------------------------------------------------+
|  Mapeamento Escolar - Manha                      |
|  Gerado em: 30/01/2026 10:00                     |
+--------------------------------------------------+
|                    SECAO 1                        |
| Turma | Disc1 | Disc2 | Disc3 | ... | Disc7      |
|-------|-------|-------|-------|-----|------------|
| 1A    | Prof  | Prof  | Prof  | ... | Prof       |
| 1B    | Prof  | Prof  | Prof  | ... | Prof       |
+--------------------------------------------------+
|                    SECAO 2                        |
| Turma | Disc8 | Disc9 | Disc10| ... | Disc14     |
|-------|-------|-------|-------|-----|------------|
| 1A    | Prof  | Prof  | Prof  | ... | Prof       |
| 1B    | Prof  | Prof  | Prof  | ... | Prof       |
+--------------------------------------------------+
```

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingSummary.tsx` | Estrutura de dados, geracao PDF e preview |

