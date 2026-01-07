import { useState, useMemo } from 'react';
import { TimetableProvider, useTimetable } from '@/contexts/TimetableContext';
import { SchoolMappingProvider, useSchoolMapping } from '@/contexts/SchoolMappingContext';
import TimetableLayout from '@/components/timetable/TimetableLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, FileSpreadsheet, Printer, Download } from 'lucide-react';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

const ExportContent = () => {
  const { entries, settings, loading: timetableLoading } = useTimetable();
  const { classes, teachers, loading: mappingLoading } = useSchoolMapping();
  
  const [exportType, setExportType] = useState<'class' | 'teacher'>('class');
  const [selectedId, setSelectedId] = useState<string>('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');

  const loading = timetableLoading || mappingLoading;

  const periodsPerDay = settings?.periods_per_day || 6;

  const generateTableData = useMemo(() => {
    if (!selectedId) return null;

    const filteredEntries = exportType === 'class'
      ? entries.filter(e => e.class_id === selectedId)
      : entries.filter(e => e.teacher_id === selectedId);

    const grid: Record<number, Record<number, { subject: string; extra?: string }>> = {};
    
    for (let period = 1; period <= periodsPerDay; period++) {
      grid[period] = {};
      for (let day = 1; day <= 5; day++) {
        grid[period][day] = { subject: '', extra: '' };
      }
    }

    filteredEntries.forEach(entry => {
      if (exportType === 'class') {
        const teacher = teachers.find(t => t.id === entry.teacher_id);
        grid[entry.period_number][entry.day_of_week] = {
          subject: entry.subject_name,
          extra: teacher?.name
        };
      } else {
        const cls = classes.find(c => c.id === entry.class_id);
        grid[entry.period_number][entry.day_of_week] = {
          subject: entry.subject_name,
          extra: cls?.name
        };
      }
    });

    return grid;
  }, [selectedId, exportType, entries, teachers, classes, periodsPerDay]);

  const handleExport = () => {
    if (!selectedId || !generateTableData) {
      toast.error('Selecione um item para exportar');
      return;
    }

    const selectedItem = exportType === 'class'
      ? classes.find(c => c.id === selectedId)
      : teachers.find(t => t.id === selectedId);

    if (!selectedItem) return;

    if (format === 'excel') {
      // Generate CSV for Excel
      let csv = 'Horário,' + DAYS.join(',') + '\n';
      
      for (let period = 1; period <= periodsPerDay; period++) {
        const row = [`${period}º Horário`];
        for (let day = 1; day <= 5; day++) {
          const cell = generateTableData[period][day];
          row.push(cell.subject ? `${cell.subject}${cell.extra ? ` (${cell.extra})` : ''}` : '');
        }
        csv += row.join(',') + '\n';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `horario_${selectedItem.name.replace(/\s/g, '_')}.csv`;
      link.click();
      
      toast.success('Arquivo exportado com sucesso!');
    } else {
      // Generate HTML for PDF/Print
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup bloqueado. Permita popups para imprimir.');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Horário - ${selectedItem.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 5px; }
            h2 { text-align: center; color: #666; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: center; }
            th { background-color: #f5f5f5; }
            .subject { font-weight: bold; }
            .extra { font-size: 12px; color: #666; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Horário Escolar</h1>
          <h2>${exportType === 'class' ? 'Turma' : 'Professor'}: ${selectedItem.name}</h2>
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                ${DAYS.map(day => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => `
                <tr>
                  <td><strong>${period}º Horário</strong></td>
                  ${DAYS.map((_, day) => {
                    const cell = generateTableData[period][day + 1];
                    return `
                      <td>
                        <div class="subject">${cell.subject || '-'}</div>
                        ${cell.extra ? `<div class="extra">${cell.extra}</div>` : ''}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <br>
          <button onclick="window.print()">Imprimir / Salvar PDF</button>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      
      toast.success('Documento aberto para impressão!');
    }
  };

  if (loading) {
    return (
      <TimetableLayout title="Exportar Horário" description="Exporte o horário em PDF ou Excel">
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </TimetableLayout>
    );
  }

  return (
    <TimetableLayout title="Exportar Horário" description="Exporte o horário em PDF ou Excel">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Options */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Opções de Exportação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Export Type */}
            <div className="space-y-2">
              <Label>Exportar por</Label>
              <RadioGroup value={exportType} onValueChange={(v) => { setExportType(v as 'class' | 'teacher'); setSelectedId(''); }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="class" id="type-class" />
                  <Label htmlFor="type-class" className="font-normal">Turma</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="teacher" id="type-teacher" />
                  <Label htmlFor="type-teacher" className="font-normal">Professor</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Selection */}
            <div className="space-y-2">
              <Label>Selecione {exportType === 'class' ? 'a Turma' : 'o Professor'}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Escolha ${exportType === 'class' ? 'uma turma' : 'um professor'}`} />
                </SelectTrigger>
                <SelectContent>
                  {exportType === 'class' ? (
                    classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))
                  ) : (
                    teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'pdf' | 'excel')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="format-pdf" />
                  <Label htmlFor="format-pdf" className="font-normal flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF / Impressão
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="format-excel" />
                  <Label htmlFor="format-excel" className="font-normal flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (CSV)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Export Button */}
            <Button className="w-full" onClick={handleExport} disabled={!selectedId}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Pré-visualização
            </CardTitle>
            <CardDescription>
              {selectedId 
                ? `Horário de ${exportType === 'class' 
                    ? classes.find(c => c.id === selectedId)?.name 
                    : teachers.find(t => t.id === selectedId)?.name}`
                : 'Selecione um item para visualizar'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generateTableData ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr>
                      <th className="p-2 text-xs font-medium border border-border bg-muted/30">
                        Horário
                      </th>
                      {DAYS.map(day => (
                        <th key={day} className="p-2 text-xs font-medium border border-border bg-muted/30">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => (
                      <tr key={period}>
                        <td className="p-2 text-xs font-medium text-center border border-border bg-muted/30">
                          {period}º
                        </td>
                        {DAYS.map((_, day) => {
                          const cell = generateTableData[period][day + 1];
                          return (
                            <td key={day} className="p-2 text-xs text-center border border-border">
                              {cell.subject ? (
                                <>
                                  <div className="font-medium">{cell.subject}</div>
                                  {cell.extra && (
                                    <div className="text-muted-foreground text-[10px]">{cell.extra}</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Selecione um item para visualizar a prévia
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TimetableLayout>
  );
};

const TimetableExport = () => {
  return (
    <SchoolMappingProvider>
      <TimetableProvider>
        <ExportContent />
      </TimetableProvider>
    </SchoolMappingProvider>
  );
};

export default TimetableExport;
