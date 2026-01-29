import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SchoolMappingProvider, useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TeacherForm from "@/components/mapping/TeacherForm";
import TeacherSummarySheet from "@/components/mapping/TeacherSummarySheet";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";
import { useToast } from "@/hooks/use-toast";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const MappingTeachersContent = () => {
  const { teachers, globalSubjects, classes, classSubjects, deleteTeacher, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<MappingTeacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<MappingTeacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<MappingTeacher | null>(null);

  const getSubjectNames = (subjectIds: string[]) => {
    return subjectIds
      .map(id => globalSubjects.find(s => s.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const getOverloadThreshold = (maxHours: number) => {
    return maxHours === 20 ? 13 : 26;
  };

  const handleDelete = async () => {
    if (!deletingTeacher) return;
    try {
      await deleteTeacher(deletingTeacher.id);
      toast({ title: "Professor excluído com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeletingTeacher(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, teacher: MappingTeacher) => {
    e.stopPropagation();
    setEditingTeacher(teacher);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, teacher: MappingTeacher) => {
    e.stopPropagation();
    setDeletingTeacher(teacher);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTeacher(null);
  };

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </SchoolMappingLayout>
    );
  }

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Professores</h1>
            <p className="text-muted-foreground">{teachers.length} professores cadastrados</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTeacher(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingTeacher ? "Editar Professor" : "Novo Professor"}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-120px)] pr-4">
                <TeacherForm teacher={editingTeacher} onClose={handleCloseDialog} />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Teachers List */}
        <div className="grid gap-4 md:grid-cols-2">
          {teachers.length === 0 ? (
            <Card className="p-8 text-center md:col-span-2">
              <p className="text-muted-foreground">Nenhum professor cadastrado</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro professor
              </Button>
            </Card>
          ) : (
            teachers.map((teacher) => {
              const isOverloaded = teacher.current_hours >= getOverloadThreshold(teacher.max_weekly_hours);
              const progressPercent = (teacher.current_hours / teacher.max_weekly_hours) * 100;

              return (
                <Card 
                  key={teacher.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setViewingTeacher(teacher)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: teacher.color }}
                          />
                          <h3 className="font-semibold">{teacher.name}</h3>
                          {isOverloaded && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {teacher.availability.map(shift => (
                            <Badge key={shift} variant="outline" className="text-xs">
                              {SHIFT_LABELS[shift] || shift}
                            </Badge>
                          ))}
                          <Badge variant="secondary" className="text-xs">
                            {getSubjectNames(teacher.subjects).length} disciplinas
                          </Badge>
                        </div>

                        {/* Carga horária */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Carga horária</span>
                            <span className={isOverloaded ? "text-amber-500 font-medium" : ""}>
                              {teacher.current_hours}h / {teacher.max_weekly_hours}h
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(progressPercent, 100)} 
                            className={`h-1.5 ${isOverloaded ? "[&>div]:bg-amber-500" : ""}`}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, teacher)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={(e) => handleDeleteClick(e, teacher)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Teacher Summary Sheet */}
      <TeacherSummarySheet
        teacher={viewingTeacher}
        classes={classes}
        classSubjects={classSubjects}
        globalSubjects={globalSubjects}
        onClose={() => setViewingTeacher(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeacher} onOpenChange={() => setDeletingTeacher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir professor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deletingTeacher?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SchoolMappingLayout>
  );
};

const MappingTeachers = () => {
  return (
    <SchoolMappingProvider>
      <MappingTeachersContent />
    </SchoolMappingProvider>
  );
};

export default MappingTeachers;
