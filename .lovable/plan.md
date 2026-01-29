

# Plano: Atualizar Exportação PDF com Dados Atualizados e 2 Páginas por Turno

## Visao Geral

1. Atualizar o mapa de abreviacoes para corresponder aos nomes exatos no banco de dados
2. Adicionar abreviacao para "Aprofundamento 2" (nome no banco) para "Aprof II"
3. Modificar a geracao do PDF para dividir cada turno em 2 paginas (metade das disciplinas em cada pagina)
4. Os dados ja sao carregados do banco via `useSchoolMapping` - nenhuma mudanca necessaria na busca

---

## Alteracoes no Arquivo: `src/pages/mapping/MappingSummary.tsx`

### 1. Atualizar Mapa de Abreviacoes (linhas 31-41)

Os nomes no banco de dados sao:
- "Aprofundamento 2" (nao "Aprofundamento II") 
- "Let. em Matematica" (com ponto)
- "Let. em Portugues" (com ponto)

```tsx
const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  'Aprofundamento I': 'Aprof I',
  'Aprofundamento II': 'Aprof II',
  'Aprofundamento 2': 'Aprof II',        // Nome no banco de dados
  'Educação Digital': 'Ed. Dig',
  'Educação Física': 'Ed. Fís',
  'Eletiva de Base': 'Eletiva',
  'Identidade e Protagonismo': 'Id. Prot',
  'Letramento em Matemática': 'Let. Mat',
  'Letramento em Português': 'Let. Port',
  'Let. em Matemática': 'Let. Mat',      // Nome no banco de dados
  'Let. em Português': 'Let. Port',      // Nome no banco de dados
  'Língua Inglesa': 'Inglês'
};
```

### 2. Modificar Interface ShiftData para Suportar Multiplas Paginas

```tsx
interface ShiftData {
  shift: string;
  shiftLabel: string;
  pages: {
    headers: string[];
    rows: string[][];
    pageNumber: number;
    totalPages: number;
  }[];
}
```

### 3. Atualizar Funcao preparePreviewData

Dividir as disciplinas em 2 grupos para criar 2 paginas por turno:

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
    
    // Dividir disciplinas em 2 grupos
    const midPoint = Math.ceil(subjectList.length / 2);
    const subjectGroups = [
      subjectList.slice(0, midPoint),
      subjectList.slice(midPoint)
    ];
    
    const pages = subjectGroups
      .filter(group => group.length > 0)
      .map((subjectGroup, pageIndex) => {
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
          pageNumber: pageIndex + 1,
          totalPages: subjectGroups.filter(g => g.length > 0).length
        };
      });
    
    data.push({
      shift,
      shiftLabel: SHIFT_LABELS[shift],
      pages
    });
  }
  
  return {
    shifts: data,
    generatedAt: new Date().toLocaleString('pt-BR')
  };
};
```

### 4. Atualizar Funcao generatePDF

Gerar uma pagina de PDF para cada pagina de dados:

```tsx
const generatePDF = () => {
  if (!previewData) return;
  
  setExporting(true);
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const date = new Date().toISOString().split('T')[0];
    let isFirstPage = true;
    
    previewData.shifts.forEach((shiftData) => {
      shiftData.pages.forEach((page) => {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;
        
        // Titulo do turno com numero da pagina
        doc.setFontSize(16);
        doc.text(`Mapeamento Escolar - ${shiftData.shiftLabel}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${previewData.generatedAt} | Página ${page.pageNumber}/${page.totalPages}`, 14, 22);
        
        // Tabela
        autoTable(doc, {
          startY: 28,
          head: [page.headers],
          body: page.rows,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
          },
          bodyStyles: { 
            fontSize: 8,
            cellPadding: 2,
            minCellWidth: 20
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 25, fontSize: 10 }
          },
          styles: {
            cellPadding: 2,
            valign: 'middle'
          }
        });
      });
    });
    
    doc.save(`mapeamento_escolar_${date}.pdf`);
    setIsPreviewOpen(false);
    toast({ title: "PDF exportado", description: "Arquivo salvo com sucesso." });
  } catch (error: any) {
    toast({ 
      title: "Erro na exportação", 
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setExporting(false);
  }
};
```

### 5. Atualizar o Dialog de Preview

Mostrar as paginas separadamente no preview:

```tsx
{previewData?.shifts.map((shiftData, idx) => (
  <div key={shiftData.shift} className={idx > 0 ? "mt-6" : ""}>
    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
      <Badge>{shiftData.shiftLabel}</Badge>
    </h3>
    
    {shiftData.pages.map((page, pageIdx) => (
      <div key={pageIdx} className={pageIdx > 0 ? "mt-4" : ""}>
        <p className="text-sm text-muted-foreground mb-2">
          Página {page.pageNumber}/{page.totalPages} - {page.headers.length - 1} disciplina(s)
        </p>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {page.headers.map((h, i) => (
                  <TableHead 
                    key={i} 
                    className={i === 0 ? "font-bold bg-muted" : "text-xs"}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <TableCell 
                      key={cellIdx}
                      className={cellIdx === 0 ? "font-medium" : "text-xs"}
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

| Item | Descricao |
|------|-----------|
| Abreviacoes | Adicionado "Aprofundamento 2" -> "Aprof II" e corrigido nomes do banco |
| Estrutura de dados | ShiftData agora suporta multiplas paginas |
| Divisao de disciplinas | Cada turno dividido em 2 paginas (metade das disciplinas cada) |
| Titulo do PDF | Inclui numero da pagina (ex: "Pagina 1/2") |
| Preview | Mostra paginas separadas com indicador |

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingSummary.tsx` | Atualizar abreviacoes, estrutura de dados e geracao do PDF |

