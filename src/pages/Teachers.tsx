import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Book, ChevronDown, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SchoolMappingProvider, useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TeacherForm from "@/components/mapping/TeacherForm";
import TeacherSummarySheet from "@/components/mapping/TeacherSummarySheet";
import TeacherAssociationDialog from "@/components/mapping/TeacherAssociationDialog";
import TeacherBulkImportDialog from "@/components/mapping/TeacherBulkImportDialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const TeachersContent = () => {
  const { teachers, globalSubjects, classes, classSubjects, deleteTeacher, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<MappingTeacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<MappingTeacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<MappingTeacher | null>(null);
  const [associatingTeacher, setAssociatingTeacher] = useState<MappingTeacher | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const getCalculatedHours = (teacherId: string) =>
    classSubjects.filter(cs => cs.teacher_id === teacherId).reduce((sum, cs) => sum + cs.weekly_classes, 0);

  const getOverloadThreshold = (maxHours: number) => (maxHours === 20 ? 13 : 26);

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

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTeacher(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Professores</h1>
          <p className="text-muted-foreground">{teachers.length} professores cadastrados</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditingTeacher(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Professor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsBulkImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Adicionar em Lote (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingTeacher ? "Editar Professor" : "Novo Professor"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-120px)] pr-4">
              <TeacherForm teacher={editingTeacher} onClose={handleCloseDialog} />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

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
            const calculatedHours = getCalculatedHours(teacher.id);
            const isOverloaded = calculatedHours >= getOverloadThreshold(teacher.max_weekly_hours);
            const progressPercent = (calculatedHours / teacher.max_weekly_hours) * 100;

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
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: teacher.color }} />
                        <h3 className="font-semibold">{teacher.name}</h3>
                        {teacher.abbreviation && (
                          <Badge variant="outline" className="text-[10px] font-mono">{teacher.abbreviation}</Badge>
                        )}
                        {isOverloaded && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Carga horária</span>
                          <span className={isOverloaded ? "text-amber-500 font-medium" : ""}>
                            {calculatedHours}h / {teacher.max_weekly_hours}h
                          </span>
                        </div>
                        <Progress
                          value={Math.min(progressPercent, 100)}
                          className={`h-1.5 ${isOverloaded ? "[&>div]:bg-amber-500" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Associar disciplinas"
                        onClick={(e) => { e.stopPropagation(); setAssociatingTeacher(teacher); }}
                      >
                        <Book className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, teacher)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeletingTeacher(teacher); }}
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

      <TeacherSummarySheet
        teacher={viewingTeacher}
        classes={classes}
        classSubjects={classSubjects}
        globalSubjects={globalSubjects}
        onClose={() => setViewingTeacher(null)}
      />

      <TeacherBulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />

      <TeacherAssociationDialog teacher={associatingTeacher} onClose={() => setAssociatingTeacher(null)} />

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
    </div>
  );
};

const Teachers = () => (
  <DashboardLayout>
    <SchoolMappingProvider>
      <TeachersContent />
    </SchoolMappingProvider>
  </DashboardLayout>
);

export default Teachers;
