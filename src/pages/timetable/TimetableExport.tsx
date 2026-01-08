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
import { FileText, FileSpreadsheet, Printer, Download, Building } from 'lucide-react';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

const ExportContent = () => {
  const { entries, settings, loading: timetableLoading } = useTimetable();
  const { classes, teachers, loading: mappingLoading } = useSchoolMapping();
  
  const [exportType, setExportType] = useState<'class' | 'teacher' | 'general'>('class');
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');

  const loading = timetableLoading || mappingLoading;

  const periodsPerDay = settings?.periods_per_day || 6;

  // Available shifts
  const availableShifts = useMemo(() => {
    const shifts = new Set(classes.map(c => c.shift));
    return Array.from(shifts);
  }, [classes]);

  // Get shift for selected item
  const getSelectedShift = useMemo(() => {
    if (exportType === 'class' && selectedId) {
      const cls = classes.find(c => c.id === selectedId);
      return cls?.shift || '';
    }
    if (exportType === 'teacher' && selectedId) {
      // Find most common shift for teacher's classes
      const teacherEntries = entries.filter(e => e.teacher_id === selectedId);
      const classIds = [...new Set(teacherEntries.map(e => e.class_id))];
      const teacherClasses = classes.filter(c => classIds.includes(c.id));
      if (teacherClasses.length > 0) {
        const shiftCounts: Record<string, number> = {};
        teacherClasses.forEach(c => {
          shiftCounts[c.shift] = (shiftCounts[c.shift] || 0) + 1;
        });
        return Object.entries(shiftCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      }
    }
    return '';
  }, [exportType, selectedId, classes, entries]);

  const generateTableData = useMemo(() => {
    if (exportType === 'general') {
      if (!selectedShift) return null;
      // Return null, will generate multiple tables for general export
      return null;
    }

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
  }, [selectedId, selectedShift, exportType, entries, teachers, classes, periodsPerDay]);

  const handleExport = () => {
    if (exportType === 'general') {
      if (!selectedShift) {
        toast.error('Selecione um turno para exportar');
        return;
      }
      handleExportGeneral();
      return;
    }

    if (!selectedId || !generateTableData) {
      toast.error('Selecione um item para exportar');
      return;
    }

    const selectedItem = exportType === 'class'
      ? classes.find(c => c.id === selectedId)
      : teachers.find(t => t.id === selectedId);

    if (!selectedItem) return;

    const shiftLabel = SHIFT_LABELS[getSelectedShift] || getSelectedShift;

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
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
            .header h2 { margin: 8px 0 0 0; font-size: 16px; color: #666; font-weight: normal; }
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
          <div class="header">
            <h1>Horário de ${selectedItem.name}</h1>
            <h2>Turno: ${shiftLabel}</h2>
          </div>
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

  const handleExportGeneral = () => {
    const shiftClasses = classes.filter(c => c.shift === selectedShift);
    const shiftLabel = SHIFT_LABELS[selectedShift] || selectedShift;

    if (shiftClasses.length === 0) {
      toast.error('Nenhuma turma encontrada para este turno');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para imprimir.');
      return;
    }

    // Generate grids for all classes in the shift
    const classGrids = shiftClasses.map(cls => {
      const classEntries = entries.filter(e => e.class_id === cls.id);
      const grid: Record<number, Record<number, { subject: string; teacher?: string }>> = {};
      
      for (let period = 1; period <= periodsPerDay; period++) {
        grid[period] = {};
        for (let day = 1; day <= 5; day++) {
          grid[period][day] = { subject: '' };
        }
      }

      classEntries.forEach(entry => {
        const teacher = teachers.find(t => t.id === entry.teacher_id);
        grid[entry.period_number][entry.day_of_week] = {
          subject: entry.subject_name,
          teacher: teacher?.name
        };
      });

      return { cls, grid };
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Horário Geral - Turno ${shiftLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .main-header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #333; padding-bottom: 20px; }
          .main-header h1 { margin: 0; font-size: 28px; font-weight: bold; }
          .main-header h2 { margin: 10px 0 0 0; font-size: 20px; color: #666; }
          .class-section { margin-bottom: 40px; page-break-inside: avoid; }
          .class-header { background: #f5f5f5; padding: 10px 15px; border-radius: 8px 8px 0 0; border: 1px solid #333; border-bottom: none; }
          .class-header h3 { margin: 0; font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; font-size: 12px; }
          th { background-color: #e8e8e8; font-weight: bold; }
          .subject { font-weight: bold; font-size: 11px; }
          .teacher { font-size: 10px; color: #666; }
          @media print {
            button { display: none; }
            .class-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="main-header">
          <h1>HORÁRIO GERAL DA ESCOLA</h1>
          <h2>Turno: ${shiftLabel}</h2>
        </div>
        
        ${classGrids.map(({ cls, grid }) => `
          <div class="class-section">
            <div class="class-header">
              <h3>${cls.name}</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 80px;">Horário</th>
                  ${DAYS.map(day => `<th>${day}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => `
                  <tr>
                    <td><strong>${period}º</strong></td>
                    ${DAYS.map((_, day) => {
                      const cell = grid[period][day + 1];
                      return `
                        <td>
                          ${cell.subject ? `
                            <div class="subject">${cell.subject}</div>
                            ${cell.teacher ? `<div class="teacher">${cell.teacher}</div>` : ''}
                          ` : '-'}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
        
        <br>
        <button onclick="window.print()">Imprimir / Salvar PDF</button>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    toast.success('Documento aberto para impressão!');
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
              <RadioGroup value={exportType} onValueChange={(v) => { setExportType(v as 'class' | 'teacher' | 'general'); setSelectedId(''); setSelectedShift(''); }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="class" id="type-class" />
                  <Label htmlFor="type-class" className="font-normal">Turma</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="teacher" id="type-teacher" />
                  <Label htmlFor="type-teacher" className="font-normal">Professor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="general" id="type-general" />
                  <Label htmlFor="type-general" className="font-normal flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Horário Geral (Mural)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Selection */}
            {exportType === 'general' ? (
              <div className="space-y-2">
                <Label>Selecione o Turno</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map(shift => (
                      <SelectItem key={shift} value={shift}>
                        {SHIFT_LABELS[shift] || shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
            )}

            {/* Format - only for class/teacher */}
            {exportType !== 'general' && (
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
            )}

            {/* Export Button */}
            <Button 
              className="w-full" 
              onClick={handleExport} 
              disabled={exportType === 'general' ? !selectedShift : !selectedId}
            >
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
              {exportType === 'general' 
                ? (selectedShift 
                    ? `Horário Geral - Turno: ${SHIFT_LABELS[selectedShift] || selectedShift}`
                    : 'Selecione um turno para visualizar')
                : (selectedId 
                    ? `Horário de ${exportType === 'class' 
                        ? classes.find(c => c.id === selectedId)?.name 
                        : teachers.find(t => t.id === selectedId)?.name}`
                    : 'Selecione um item para visualizar')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exportType === 'general' ? (
              selectedShift ? (
                <div className="space-y-6">
                  <div className="text-center py-4 border-b">
                    <h2 className="text-xl font-bold">HORÁRIO GERAL DA ESCOLA</h2>
                    <p className="text-muted-foreground">Turno: {SHIFT_LABELS[selectedShift] || selectedShift}</p>
                  </div>
                  {classes.filter(c => c.shift === selectedShift).slice(0, 2).map(cls => {
                    const classEntries = entries.filter(e => e.class_id === cls.id);
                    return (
                      <div key={cls.id} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 font-medium text-sm">
                          {cls.name}
                        </div>
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
                              {Array.from({ length: Math.min(3, periodsPerDay) }, (_, i) => i + 1).map(period => (
                                <tr key={period}>
                                  <td className="p-2 text-xs font-medium text-center border border-border bg-muted/30">
                                    {period}º
                                  </td>
                                  {DAYS.map((_, day) => {
                                    const entry = classEntries.find(e => e.day_of_week === day + 1 && e.period_number === period);
                                    return (
                                      <td key={day} className="p-2 text-xs text-center border border-border">
                                        {entry?.subject_name || '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  {classes.filter(c => c.shift === selectedShift).length > 2 && (
                    <p className="text-center text-sm text-muted-foreground">
                      +{classes.filter(c => c.shift === selectedShift).length - 2} turmas adicionais no documento completo
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Selecione um turno para visualizar a prévia
                </div>
              )
            ) : generateTableData ? (
              <div className="space-y-4">
                {/* Header with name highlighted */}
                <div className="text-center py-4 border-b">
                  <h2 className="text-xl font-bold">
                    Horário de {exportType === 'class' 
                      ? classes.find(c => c.id === selectedId)?.name 
                      : teachers.find(t => t.id === selectedId)?.name}
                  </h2>
                  <p className="text-muted-foreground">
                    Turno: {SHIFT_LABELS[getSelectedShift] || getSelectedShift}
                  </p>
                </div>
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
