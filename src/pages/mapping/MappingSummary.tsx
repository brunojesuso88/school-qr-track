import { useState } from "react";
import { Users, GraduationCap, BookOpen, AlertTriangle, CheckCircle2, Clock, Download, Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SchoolMappingProvider, useSchoolMapping } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";
import { useToast } from "@/hooks/use-toast";
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

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

const abbreviateSubject = (name: string): string => {
  return SUBJECT_ABBREVIATIONS[name] || name;
};

interface SectionData {
  headers: string[];
  rows: string[][];
  sectionNumber: number;
}

interface ShiftData {
  shift: string;
  shiftLabel: string;
  sections: SectionData[];
}

interface TeacherSummaryRow {
  teacherName: string;
  className: string;
  subjectName: string;
  weeklyClasses: number;
  totalHours: number; // used for grouping footer
}

interface PreviewData {
  shifts: ShiftData[];
  teacherSummary: TeacherSummaryRow[];
  generatedAt: string;
}

const MappingSummaryContent = () => {
  const { teachers, globalSubjects, classes, classSubjects, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const preparePreviewData = (): PreviewData => {
    const shifts = ['morning', 'afternoon', 'evening'] as const;
    const data: ShiftData[] = [];
    
    for (const shift of shifts) {
      const shiftClasses = classes.filter(c => c.shift === shift);
      if (shiftClasses.length === 0) continue;
      
      // Coletar disciplinas únicas deste turno
      const shiftSubjects = new Set<string>();
      shiftClasses.forEach(c => {
        classSubjects
          .filter(cs => cs.class_id === c.id)
          .forEach(cs => shiftSubjects.add(cs.subject_name));
      });
      
      const subjectList = Array.from(shiftSubjects).sort();
      
      // Dividir disciplinas em 2 grupos (seções horizontais)
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
    
    // Build teacher summary data
    const teacherSummaryMap = new Map<string, { rows: TeacherSummaryRow[]; totalHours: number }>();
    
    teachers.forEach(t => {
      const teacherCS = classSubjects.filter(cs => cs.teacher_id === t.id);
      if (teacherCS.length === 0) return;
      
      const rows: TeacherSummaryRow[] = teacherCS.map(cs => {
        const cls = classes.find(c => c.id === cs.class_id);
        return {
          teacherName: t.name,
          className: cls?.name || '-',
          subjectName: cs.subject_name,
          weeklyClasses: cs.weekly_classes,
          totalHours: t.current_hours,
        };
      });
      
      teacherSummaryMap.set(t.name, { rows, totalHours: t.current_hours });
    });

    const teacherSummary: TeacherSummaryRow[] = [];
    // Sort teachers alphabetically
    const sortedNames = Array.from(teacherSummaryMap.keys()).sort();
    sortedNames.forEach(name => {
      const entry = teacherSummaryMap.get(name)!;
      teacherSummary.push(...entry.rows);
    });

    return {
      shifts: data,
      teacherSummary,
      generatedAt: new Date().toLocaleString('pt-BR')
    };
  };

  const openPreview = () => {
    const data = preparePreviewData();
    if (data.shifts.length === 0) {
      toast({ 
        title: "Nenhum dado", 
        description: "Não há turmas cadastradas para exportar.",
        variant: "destructive"
      });
      return;
    }
    setPreviewData(data);
    setIsPreviewOpen(true);
  };

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
        
        // Título do turno
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
            }
          });
        });
      });
      
      // Teacher Summary Page(s)
      if (previewData.teacherSummary.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Resumo por Professor', margin, 12);
        doc.setFontSize(8);
        doc.text(`Gerado em: ${previewData.generatedAt}`, margin, 18);

        // Build autoTable rows grouped by teacher
        const tableRows: (string | number)[][] = [];
        let currentTeacher = '';
        
        previewData.teacherSummary.forEach(row => {
          const isNewTeacher = row.teacherName !== currentTeacher;
          currentTeacher = row.teacherName;
          tableRows.push([
            isNewTeacher ? row.teacherName : '',
            row.className,
            row.subjectName,
            row.weeklyClasses,
          ]);
          
          // Check if next row is different teacher - add total row
          const idx = previewData.teacherSummary.indexOf(row);
          const nextRow = previewData.teacherSummary[idx + 1];
          if (!nextRow || nextRow.teacherName !== currentTeacher) {
            tableRows.push([
              '',
              '',
              'Total',
              row.totalHours,
            ]);
          }
        });

        autoTable(doc, {
          startY: 22,
          head: [['Professor', 'Turma', 'Disciplina', 'Aulas/Sem']],
          body: tableRows,
          theme: 'grid',
          margin: { left: margin, right: margin },
          headStyles: {
            fillColor: [59, 130, 246],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
          },
          bodyStyles: {
            fontSize: 8,
            valign: 'middle',
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 30 },
            3: { halign: 'center', cellWidth: 25 },
          },
          didParseCell: (data: any) => {
            // Bold the total rows
            if (data.section === 'body' && data.row.raw[2] === 'Total') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
            }
          },
        });
      }

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

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </SchoolMappingLayout>
    );
  }

  // Calculate statistics
  const totalWeeklyHours = teachers.reduce((acc, t) => acc + t.max_weekly_hours, 0);
  const usedWeeklyHours = teachers.reduce((acc, t) => acc + t.current_hours, 0);
  const assignedSubjects = classSubjects.filter(cs => cs.teacher_id).length;
  const totalClassSubjects = classSubjects.length;
  
  const overloadedTeachers = teachers.filter(t => t.current_hours >= t.max_weekly_hours * 0.8);
  const availableTeachers = teachers.filter(t => t.current_hours < t.max_weekly_hours * 0.5);
  
  const incompleteClasses = classes.filter(c => {
    const subjects = classSubjects.filter(cs => cs.class_id === c.id);
    return subjects.some(s => !s.teacher_id);
  });

  const classesByShift = {
    morning: classes.filter(c => c.shift === 'morning').length,
    afternoon: classes.filter(c => c.shift === 'afternoon').length,
    evening: classes.filter(c => c.shift === 'evening').length
  };

  const getClassWeeklyHours = (classData: any) => {
    return classData.weekly_hours || (classData.shift === 'evening' ? 25 : 30);
  };

  const getClassAssignedHours = (classId: string) => {
    return classSubjects
      .filter(cs => cs.class_id === classId && cs.teacher_id)
      .reduce((acc, cs) => acc + cs.weekly_classes, 0);
  };

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resumo Geral</h1>
            <p className="text-muted-foreground">Visão consolidada para conferência da direção</p>
          </div>
          <Button onClick={openPreview} disabled={classes.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Professores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teachers.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {overloadedTeachers.length} com alta carga • {availableTeachers.length} disponíveis
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Turmas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {classesByShift.morning} manhã • {classesByShift.afternoon} tarde • {classesByShift.evening} noite
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Disciplinas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalSubjects.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {assignedSubjects} atribuídas / {totalClassSubjects} total
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workload Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Distribuição de Carga Horária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Horas distribuídas</span>
                <span>{usedWeeklyHours}h / {totalWeeklyHours}h disponíveis</span>
              </div>
              <Progress value={totalWeeklyHours > 0 ? (usedWeeklyHours / totalWeeklyHours) * 100 : 0} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Disciplinas atribuídas</span>
                <span>{assignedSubjects} / {totalClassSubjects}</span>
              </div>
              <Progress value={totalClassSubjects > 0 ? (assignedSubjects / totalClassSubjects) * 100 : 0} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Teachers with alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Professores com Alta Carga ({overloadedTeachers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overloadedTeachers.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Todos os professores estão com carga adequada
                </div>
              ) : (
                <div className="space-y-3">
                  {overloadedTeachers.map(teacher => {
                    const percent = (teacher.current_hours / teacher.max_weekly_hours) * 100;
                    return (
                      <div key={teacher.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: teacher.color }}
                            />
                            <span className="text-sm font-medium">{teacher.name}</span>
                          </div>
                          <span className="text-xs text-amber-500 font-medium">
                            {teacher.current_hours}h / {teacher.max_weekly_hours}h
                          </span>
                        </div>
                        <Progress value={Math.min(percent, 100)} className="h-1.5 [&>div]:bg-amber-500" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incomplete classes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Turmas Incompletas ({incompleteClasses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incompleteClasses.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Todas as turmas estão completas
                </div>
              ) : (
                <div className="space-y-3">
                  {incompleteClasses.slice(0, 5).map(classData => {
                    const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
                    const missing = subjects.filter(s => !s.teacher_id);
                    const totalHours = getClassWeeklyHours(classData);
                    const assignedHours = getClassAssignedHours(classData.id);
                    
                    return (
                      <div key={classData.id} className="p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{classData.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {SHIFT_LABELS[classData.shift]}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {assignedHours}h / {totalHours}h • {missing.length} disciplina(s) sem professor
                        </div>
                        <div className="text-xs text-amber-500 mt-1">
                          {missing.map(s => s.subject_name).join(", ")}
                        </div>
                      </div>
                    );
                  })}
                  {incompleteClasses.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      + {incompleteClasses.length - 5} turma(s) adicionais
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Detailed Class List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Todas as Turmas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {classes.map(classData => {
                const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
                const assignedCount = subjects.filter(s => s.teacher_id).length;
                const totalHours = getClassWeeklyHours(classData);
                const assignedHours = getClassAssignedHours(classData.id);
                const isComplete = assignedCount === subjects.length && subjects.length > 0;
                
                return (
                  <div 
                    key={classData.id} 
                    className={`p-3 rounded-lg border ${isComplete ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{classData.name}</span>
                      <div className="flex items-center gap-1">
                        {isComplete && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        <Badge variant="outline" className="text-xs">
                          {SHIFT_LABELS[classData.shift]}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Carga: {assignedHours}h / {totalHours}h</span>
                        <span>{assignedCount}/{subjects.length} disc.</span>
                      </div>
                      <Progress 
                        value={totalHours > 0 ? (assignedHours / totalHours) * 100 : 0} 
                        className="h-1.5"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => {
            if (e.type !== 'pointerdown') {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Visualização da Exportação
            </DialogTitle>
            <DialogDescription>
              Confira os dados antes de exportar o PDF
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[calc(90vh-200px)] pr-4">
            {previewData?.shifts.map((shiftData, idx) => (
              <div key={shiftData.shift} className={idx > 0 ? "mt-6" : ""}>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Badge>{shiftData.shiftLabel}</Badge>
                  <span className="text-sm text-muted-foreground font-normal">
                    (1 página com {shiftData.sections.length} seção(ões))
                  </span>
                </h3>
                
                {shiftData.sections.map((section, sectionIdx) => (
                  <div key={sectionIdx} className={sectionIdx > 0 ? "mt-4" : ""}>
                    <p className="text-sm text-muted-foreground mb-2">
                      Seção {section.sectionNumber} - {section.headers.length - 1} disciplina(s)
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

            {/* Teacher Summary Preview */}
            {previewData?.teacherSummary && previewData.teacherSummary.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Resumo por Professor</Badge>
                  <span className="text-sm text-muted-foreground font-normal">
                    (página adicional no PDF)
                  </span>
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold">Professor</TableHead>
                        <TableHead>Turma</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead className="text-center">Aulas/Sem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let currentTeacher = '';
                        return previewData.teacherSummary.map((row, idx) => {
                          const isNewTeacher = row.teacherName !== currentTeacher;
                          currentTeacher = row.teacherName;
                          const nextRow = previewData.teacherSummary[idx + 1];
                          const isLastOfTeacher = !nextRow || nextRow.teacherName !== currentTeacher;
                          
                          return (
                            <>
                              <TableRow key={`row-${idx}`} className={isNewTeacher ? "border-t-2" : ""}>
                                <TableCell className="font-medium">
                                  {isNewTeacher ? row.teacherName : ''}
                                </TableCell>
                                <TableCell>{row.className}</TableCell>
                                <TableCell>{row.subjectName}</TableCell>
                                <TableCell className="text-center">{row.weeklyClasses}</TableCell>
                              </TableRow>
                              {isLastOfTeacher && (
                                <TableRow key={`total-${idx}`} className="bg-muted/50">
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="font-medium">Total</TableCell>
                                  <TableCell className="text-center font-medium">{row.totalHours}h</TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="mt-4">
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
    </SchoolMappingLayout>
  );
};

const MappingSummary = () => {
  return (
    <SchoolMappingProvider>
      <MappingSummaryContent />
    </SchoolMappingProvider>
  );
};

export default MappingSummary;
