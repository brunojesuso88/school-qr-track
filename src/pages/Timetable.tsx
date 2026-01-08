import { useState, useMemo } from 'react';
import { TimetableProvider, useTimetable, Conflict } from '@/contexts/TimetableContext';
import { SchoolMappingProvider, useSchoolMapping } from '@/contexts/SchoolMappingContext';
import TimetableLayout from '@/components/timetable/TimetableLayout';
import TimetableGrid from '@/components/timetable/TimetableGrid';
import ConflictAlert from '@/components/timetable/ConflictAlert';
import WorkloadIndicator from '@/components/timetable/WorkloadIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, GraduationCap, BookOpen, Clock } from 'lucide-react';

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

const DAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
};

type DetailDialogType = 'entries' | 'classes' | 'teachers' | 'conflicts' | null;

const TimetableContent = () => {
  const { entries, conflicts, loading: timetableLoading } = useTimetable();
  const { teachers, classes, classSubjects, loading: mappingLoading } = useSchoolMapping();
  
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [detailDialog, setDetailDialog] = useState<DetailDialogType>(null);

  const loading = timetableLoading || mappingLoading;

  const filteredClasses = useMemo(() => {
    if (selectedShift === 'all') return classes;
    return classes.filter(c => c.shift === selectedShift);
  }, [classes, selectedShift]);

  const filteredTeachers = useMemo(() => {
    if (selectedShift === 'all') return teachers;
    return teachers.filter(t => t.availability?.includes(selectedShift));
  }, [teachers, selectedShift]);

  // Stats
  const totalEntries = entries.length;
  const totalConflicts = conflicts.filter(c => c.severity === 'error').length;
  const classesWithEntries = new Set(entries.map(e => e.class_id)).size;

  // Teacher workload stats
  const teacherWorkloads = useMemo(() => {
    const workloads = new Map<string, number>();
    entries.forEach(entry => {
      if (entry.teacher_id) {
        workloads.set(entry.teacher_id, (workloads.get(entry.teacher_id) || 0) + 1);
      }
    });
    return workloads;
  }, [entries]);

  // Class completeness
  const classCompleteness = useMemo(() => {
    return classes.map(cls => {
      const classEntries = entries.filter(e => e.class_id === cls.id).length;
      const totalSubjectHours = classSubjects
        .filter(cs => cs.class_id === cls.id)
        .reduce((sum, cs) => sum + cs.weekly_classes, 0);
      return {
        ...cls,
        entriesCount: classEntries,
        totalHours: totalSubjectHours || cls.weekly_hours,
        percentage: totalSubjectHours > 0 ? Math.round((classEntries / totalSubjectHours) * 100) : 0
      };
    });
  }, [classes, entries, classSubjects]);

  // Get class name by ID
  const getClassName = (classId: string) => classes.find(c => c.id === classId)?.name || classId;
  
  // Get teacher name by ID
  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return '-';
    return teachers.find(t => t.id === teacherId)?.name || '-';
  };

  if (loading) {
    return (
      <TimetableLayout title="Criação do Horário" description="Visualize e edite o horário escolar">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </TimetableLayout>
    );
  }

  return (
    <TimetableLayout title="Criação do Horário" description="Visualize e edite o horário escolar">
      <div className="space-y-6">
        {/* Stats Cards - Clickable */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailDialog('entries')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalEntries}</p>
                  <p className="text-xs text-muted-foreground">Aulas Alocadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailDialog('classes')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <GraduationCap className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{classesWithEntries}/{classes.length}</p>
                  <p className="text-xs text-muted-foreground">Turmas com Horário</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailDialog('teachers')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Users className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teachers.length}</p>
                  <p className="text-xs text-muted-foreground">Professores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailDialog('conflicts')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${totalConflicts > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                  <BookOpen className={`h-5 w-5 ${totalConflicts > 0 ? 'text-destructive' : 'text-success'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalConflicts}</p>
                  <p className="text-xs text-muted-foreground">Conflitos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conflicts Alert */}
        <ConflictAlert conflicts={conflicts} />

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Turnos</SelectItem>
              <SelectItem value="morning">Manhã</SelectItem>
              <SelectItem value="afternoon">Tarde</SelectItem>
              <SelectItem value="evening">Noite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'class' | 'teacher')}>
          <TabsList>
            <TabsTrigger value="class">Por Turma</TabsTrigger>
            <TabsTrigger value="teacher">Por Professor</TabsTrigger>
          </TabsList>

          <TabsContent value="class" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-4">
              {/* Class List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Turmas</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1">
                      {filteredClasses.map(cls => {
                        const classEntryCount = entries.filter(e => e.class_id === cls.id).length;
                        const isSelected = selectedClassId === cls.id;
                        
                        return (
                          <button
                            key={cls.id}
                            className={`w-full text-left p-2 rounded-md transition-colors ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => setSelectedClassId(cls.id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{cls.name}</span>
                              <Badge variant={isSelected ? 'secondary' : 'outline'} className="text-xs">
                                {classEntryCount}
                              </Badge>
                            </div>
                            <span className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {cls.shift === 'morning' ? 'Manhã' : cls.shift === 'afternoon' ? 'Tarde' : 'Noite'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Timetable Grid */}
              <Card className="lg:col-span-3">
                <CardContent className="p-4">
                  {selectedClassId ? (
                    <TimetableGrid classId={selectedClassId} />
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      Selecione uma turma para visualizar o horário
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="teacher" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-4">
              {/* Teacher List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Professores</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1">
                      {filteredTeachers.map(teacher => {
                        const workload = teacherWorkloads.get(teacher.id) || 0;
                        const isSelected = selectedTeacherId === teacher.id;
                        
                        return (
                          <button
                            key={teacher.id}
                            className={`w-full text-left p-2 rounded-md transition-colors ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => setSelectedTeacherId(teacher.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full shrink-0" 
                                style={{ backgroundColor: teacher.color }}
                              />
                              <span className="font-medium text-sm truncate">{teacher.name}</span>
                            </div>
                            <div className="mt-1">
                              <WorkloadIndicator 
                                current={workload} 
                                max={teacher.max_weekly_hours} 
                                size="sm"
                                showValues
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Teacher's Schedule Grid */}
              <Card className="lg:col-span-3">
                <CardContent className="p-4">
                  {selectedTeacherId ? (
                    (() => {
                      const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
                      const teacherEntries = entries.filter(e => e.teacher_id === selectedTeacherId);
                      
                      if (teacherEntries.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                            Este professor não possui aulas atribuídas
                          </div>
                        );
                      }

                      // Get unique classes for this teacher
                      const teacherClassIds = [...new Set(teacherEntries.map(e => e.class_id))];
                      const teacherClasses = classes.filter(c => teacherClassIds.includes(c.id));

                      return (
                        <div className="space-y-6">
                          <div className="text-center pb-4 border-b">
                            <h3 className="text-lg font-semibold">{selectedTeacher?.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {teacherEntries.length} aulas em {teacherClasses.length} turma(s)
                            </p>
                          </div>
                          {teacherClasses.map(cls => {
                            const classEntriesForTeacher = entries.filter(
                              e => e.class_id === cls.id && e.teacher_id === selectedTeacherId
                            );
                            
                            return (
                              <div key={cls.id}>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                  {cls.name}
                                  <Badge variant="outline" className="text-xs">
                                    {classEntriesForTeacher.length} aulas
                                  </Badge>
                                </h4>
                                <TimetableGrid classId={cls.id} highlightTeacherId={selectedTeacherId} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      Selecione um professor para visualizar suas aulas
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialogs */}
      <Dialog open={detailDialog === 'entries'} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Aulas Alocadas ({totalEntries})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{getClassName(entry.class_id)}</TableCell>
                    <TableCell>{entry.subject_name}</TableCell>
                    <TableCell>{getTeacherName(entry.teacher_id)}</TableCell>
                    <TableCell>{DAY_LABELS[entry.day_of_week] || entry.day_of_week}</TableCell>
                    <TableCell>{entry.period_number}º</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialog === 'classes'} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Turmas com Horário</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Aulas Alocadas</TableHead>
                  <TableHead>Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classCompleteness.map(cls => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{SHIFT_LABELS[cls.shift] || cls.shift}</TableCell>
                    <TableCell>{cls.entriesCount}/{cls.totalHours}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, cls.percentage)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{cls.percentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialog === 'teachers'} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Carga Horária dos Professores</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professor</TableHead>
                  <TableHead>Aulas Alocadas</TableHead>
                  <TableHead>Máximo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map(teacher => {
                  const workload = teacherWorkloads.get(teacher.id) || 0;
                  const percentage = (workload / teacher.max_weekly_hours) * 100;
                  const isOverloaded = workload > teacher.max_weekly_hours;
                  
                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: teacher.color }}
                          />
                          {teacher.name}
                        </div>
                      </TableCell>
                      <TableCell>{workload}h</TableCell>
                      <TableCell>{teacher.max_weekly_hours}h</TableCell>
                      <TableCell>
                        <Badge variant={isOverloaded ? 'destructive' : percentage > 80 ? 'secondary' : 'outline'}>
                          {isOverloaded ? 'Excedido' : percentage > 80 ? 'Quase cheio' : 'OK'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialog === 'conflicts'} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Conflitos ({conflicts.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {conflicts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Nenhum conflito encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((conflict, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant={conflict.severity === 'error' ? 'destructive' : 'secondary'}>
                          {conflict.severity === 'error' ? 'Erro' : 'Aviso'}
                        </Badge>
                      </TableCell>
                      <TableCell>{conflict.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </TimetableLayout>
  );
};

const Timetable = () => {
  return (
    <SchoolMappingProvider>
      <TimetableProvider>
        <TimetableContent />
      </TimetableProvider>
    </SchoolMappingProvider>
  );
};

export default Timetable;
