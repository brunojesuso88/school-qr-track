import { useState } from "react";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SchoolMappingProvider, useSchoolMapping, MappingClass } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClassForm from "@/components/mapping/ClassForm";
import ClassSubjectsDialog from "@/components/mapping/ClassSubjectsDialog";
import ClassSummarySheet from "@/components/mapping/ClassSummarySheet";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";
import { useToast } from "@/hooks/use-toast";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const MappingClassesContent = () => {
  const { classes, classSubjects, teachers, deleteClass, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<MappingClass | null>(null);
  const [deletingClass, setDeletingClass] = useState<MappingClass | null>(null);
  const [managingSubjectsClass, setManagingSubjectsClass] = useState<MappingClass | null>(null);
  const [viewingClass, setViewingClass] = useState<MappingClass | null>(null);

  const getClassSubjectCount = (classId: string) => {
    return classSubjects.filter(cs => cs.class_id === classId).length;
  };

  const getClassAssignedHours = (classId: string) => {
    return classSubjects
      .filter(cs => cs.class_id === classId && cs.teacher_id)
      .reduce((acc, cs) => acc + cs.weekly_classes, 0);
  };

  const handleDelete = async () => {
    if (!deletingClass) return;
    try {
      await deleteClass(deletingClass.id);
      toast({ title: "Turma excluída com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeletingClass(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, classData: MappingClass) => {
    e.stopPropagation();
    setEditingClass(classData);
    setIsDialogOpen(true);
  };

  const handleManageSubjects = (e: React.MouseEvent, classData: MappingClass) => {
    e.stopPropagation();
    setManagingSubjectsClass(classData);
  };

  const handleDeleteClick = (e: React.MouseEvent, classData: MappingClass) => {
    e.stopPropagation();
    setDeletingClass(classData);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClass(null);
  };

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
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
            <h1 className="text-2xl font-bold text-foreground">Turmas</h1>
            <p className="text-muted-foreground">{classes.length} turmas cadastradas</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClass(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClass ? "Editar Turma" : "Nova Turma"}
                </DialogTitle>
              </DialogHeader>
              <ClassForm classData={editingClass} onClose={handleCloseDialog} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Classes List */}
        <div className="grid gap-4 md:grid-cols-2">
          {classes.length === 0 ? (
            <Card className="p-8 text-center md:col-span-2">
              <p className="text-muted-foreground">Nenhuma turma cadastrada</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira turma
              </Button>
            </Card>
          ) : (
            classes.map((classData) => {
              const assignedHours = getClassAssignedHours(classData.id);
              const totalHours = classData.weekly_hours;
              const progressPercent = totalHours > 0 ? (assignedHours / totalHours) * 100 : 0;
              
              return (
                <Card 
                  key={classData.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setViewingClass(classData)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <h3 className="font-semibold">{classData.name}</h3>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline">
                            {SHIFT_LABELS[classData.shift] || classData.shift}
                          </Badge>
                          {classData.student_count && (
                            <Badge variant="secondary">
                              {classData.student_count} alunos
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {getClassSubjectCount(classData.id)} disciplinas
                          </Badge>
                        </div>
                        
                        {/* Workload Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Carga horária</span>
                            <span>{assignedHours}h / {totalHours}h</span>
                          </div>
                          <Progress value={progressPercent} className="h-1.5" />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => handleManageSubjects(e, classData)}
                        >
                          <BookOpen className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, classData)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={(e) => handleDeleteClick(e, classData)}
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

      {/* Class Summary Sheet */}
      <ClassSummarySheet
        classData={viewingClass}
        teachers={teachers}
        classSubjects={classSubjects}
        onClose={() => setViewingClass(null)}
      />

      {/* Manage Subjects Dialog */}
      {managingSubjectsClass && (
        <ClassSubjectsDialog 
          classData={managingSubjectsClass} 
          onClose={() => setManagingSubjectsClass(null)} 
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingClass} onOpenChange={() => setDeletingClass(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deletingClass?.name}? Todas as disciplinas vinculadas também serão excluídas. Esta ação não pode ser desfeita.
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

const MappingClasses = () => {
  return (
    <SchoolMappingProvider>
      <MappingClassesContent />
    </SchoolMappingProvider>
  );
};

export default MappingClasses;
