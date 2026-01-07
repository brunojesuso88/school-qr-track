import { useState, useMemo } from 'react';
import { TimetableProvider, useTimetable } from '@/contexts/TimetableContext';
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
import { Users, GraduationCap, BookOpen, Clock } from 'lucide-react';

const TimetableContent = () => {
  const { entries, conflicts, loading: timetableLoading } = useTimetable();
  const { teachers, classes, classSubjects, loading: mappingLoading } = useSchoolMapping();
  
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

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
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
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

          <Card>
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

          <Card>
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

          <Card>
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

              {/* Teacher's Classes */}
              <Card className="lg:col-span-3">
                <CardContent className="p-4">
                  {selectedTeacherId ? (
                    <div className="space-y-4">
                      {classes.map(cls => {
                        const teacherEntriesInClass = entries.filter(
                          e => e.class_id === cls.id && e.teacher_id === selectedTeacherId
                        );
                        
                        if (teacherEntriesInClass.length === 0) return null;
                        
                        return (
                          <div key={cls.id}>
                            <h4 className="font-medium text-sm mb-2">{cls.name}</h4>
                            <TimetableGrid classId={cls.id} />
                          </div>
                        );
                      })}
                    </div>
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
