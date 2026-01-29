

# Plano: Exportação PDF com Preview no Resumo

## Visao Geral

Transformar a exportação do mapeamento de CSV para PDF, com visualização prévia em um diálogo antes do download. O PDF terá formato tabular com turmas nas linhas, disciplinas nas colunas e páginas separadas por turno.

---

## Alterações Necessárias

### 1. Instalar Dependências

Adicionar as bibliotecas necessárias para geração de PDF:

```bash
npm install jspdf jspdf-autotable
```

**Tipos TypeScript:**
```bash
npm install -D @types/jspdf @types/jspdf-autotable
```

---

### 2. Arquivo: `src/pages/mapping/MappingSummary.tsx`

**Mudanças principais:**

1. **Novo estado para controle do diálogo de preview:**
```tsx
const [isPreviewOpen, setIsPreviewOpen] = useState(false);
const [previewData, setPreviewData] = useState<PreviewData | null>(null);
```

2. **Interface para dados do preview:**
```tsx
interface ShiftData {
  shift: string;
  shiftLabel: string;
  headers: string[];
  rows: string[][];
}

interface PreviewData {
  shifts: ShiftData[];
  generatedAt: string;
}
```

3. **Função para preparar dados de preview:**
```tsx
const preparePreviewData = (): PreviewData => {
  const shifts = ['morning', 'afternoon', 'evening'] as const;
  const data: ShiftData[] = [];
  
  for (const shift of shifts) {
    const shiftClasses = classes.filter(c => c.shift === shift);
    if (shiftClasses.length === 0) continue;
    
    // Coletar disciplinas únicas
    const shiftSubjects = new Set<string>();
    shiftClasses.forEach(c => {
      classSubjects
        .filter(cs => cs.class_id === c.id)
        .forEach(cs => shiftSubjects.add(cs.subject_name));
    });
    
    const subjectList = Array.from(shiftSubjects).sort();
    const headers = ['Turma', ...subjectList];
    
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
    
    data.push({
      shift,
      shiftLabel: SHIFT_LABELS[shift],
      headers,
      rows
    });
  }
  
  return {
    shifts: data,
    generatedAt: new Date().toLocaleString('pt-BR')
  };
};
```

4. **Função para gerar e baixar o PDF:**
```tsx
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generatePDF = () => {
  if (!previewData) return;
  
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const date = new Date().toISOString().split('T')[0];
  
  previewData.shifts.forEach((shiftData, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    // Titulo do turno
    doc.setFontSize(16);
    doc.text(`Mapeamento Escolar - ${shiftData.shiftLabel}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${previewData.generatedAt}`, 14, 22);
    
    // Tabela
    autoTable(doc, {
      startY: 28,
      head: [shiftData.headers],
      body: shiftData.rows,
      theme: 'grid',
      headStyles: { 
        fillColor: [59, 130, 246], // azul
        fontSize: 8 
      },
      bodyStyles: { 
        fontSize: 7 
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 25 }
      }
    });
  });
  
  doc.save(`mapeamento_escolar_${date}.pdf`);
  setIsPreviewOpen(false);
  toast({ title: "PDF exportado", description: "Arquivo salvo com sucesso." });
};
```

5. **Botão atualizado:**
```tsx
<Button onClick={() => {
  const data = preparePreviewData();
  setPreviewData(data);
  setIsPreviewOpen(true);
}} disabled={classes.length === 0}>
  <Download className="h-4 w-4 mr-2" />
  Exportar PDF
</Button>
```

6. **Diálogo de Preview:**
```tsx
<Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Visualização da Exportação
      </DialogTitle>
      <DialogDescription>
        Confira os dados antes de exportar o PDF
      </DialogDescription>
    </DialogHeader>
    
    <ScrollArea className="h-[60vh] pr-4">
      {previewData?.shifts.map((shiftData, idx) => (
        <div key={shiftData.shift} className={idx > 0 ? "mt-6" : ""}>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Badge>{shiftData.shiftLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {shiftData.rows.length} turma(s)
            </span>
          </h3>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {shiftData.headers.map((h, i) => (
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
                {shiftData.rows.map((row, rowIdx) => (
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
    </ScrollArea>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={generatePDF} disabled={exporting}>
        {exporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Baixar PDF
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Imports Adicionais

```tsx
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

---

## Estrutura do PDF

O PDF gerado terá:
- Orientação paisagem (landscape) para acomodar várias colunas
- Uma página por turno
- Cabeçalho com título e data de geração
- Tabela com grid colorido
- Primeira coluna (turma) em negrito

```text
+--------------------------------------------------+
|  Mapeamento Escolar - Manhã                       |
|  Gerado em: 29/01/2026 18:21                      |
+--------------------------------------------------+
| Turma    | Português    | Matemática | História  |
+--------------------------------------------------+
| 1º Ano A | Maria (4)    | João (4)   | Ana (2)   |
| 1º Ano B | Maria (4)    | Carlos (4) | Ana (2)   |
| 2º Ano A | Fernanda (4) | João (4)   | - (2)     |
+--------------------------------------------------+
                    [Nova Página]
+--------------------------------------------------+
|  Mapeamento Escolar - Tarde                       |
...
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `package.json` | Adicionar jspdf e jspdf-autotable |
| `src/pages/mapping/MappingSummary.tsx` | Substituir exportação CSV por PDF com preview |

---

## Fluxo de Uso

1. Usuário clica em "Exportar PDF"
2. Abre diálogo com visualização das tabelas por turno
3. Usuário confere os dados
4. Clica em "Baixar PDF"
5. PDF é gerado e baixado automaticamente
6. Diálogo fecha

