import { useState } from "react";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchoolMappingProvider, useSchoolMapping, MappingGlobalSubject } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SubjectForm from "@/components/mapping/SubjectForm";
import SubjectsBulkImportDialog from "@/components/mapping/SubjectsBulkImportDialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { classSeriesLabel, normalizeSeriesList } from "@/lib/series";

const SubjectsContent = () => {
  const { globalSubjects, deleteGlobalSubject, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<MappingGlobalSubject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<MappingGlobalSubject | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const handleDelete = async () => {
    if (!deletingSubject) return;
    try {
      await deleteGlobalSubject(deletingSubject.id);
      toast({ title: "Disciplina excluída com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeletingSubject(null);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSubject(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const renderSubjectCard = (subject: MappingGlobalSubject) => {
    const series = normalizeSeriesList((subject as any).series);
    const aliases: string[] = ((subject as any).aliases ?? []) as string[];
    return (
      <Card key={subject.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{subject.name}</h3>
                {subject.abbreviation && (
                  <Badge variant="outline" className="font-mono text-xs">{subject.abbreviation}</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{subject.default_weekly_classes} aulas/semana</Badge>
                {series.map(s => (
                  <Badge key={s} variant="outline" className="text-xs">{classSeriesLabel(s)}</Badge>
                ))}
              </div>
              {aliases.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sinônimos: {aliases.join(", ")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Valor padrão — propagado a todas as turmas ao salvar.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setEditingSubject(subject); setIsDialogOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingSubject(subject)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disciplinas</h1>
          <p className="text-muted-foreground">
            {globalSubjects.length} disciplinas no catálogo oficial da escola
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSubject(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSubject ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle>
              </DialogHeader>
              <SubjectForm subject={editingSubject} onClose={handleCloseDialog} />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Adicionar em Lote (PDF)
          </Button>
        </div>
      </div>

      {globalSubjects.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma disciplina cadastrada</p>
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar primeira disciplina
          </Button>
        </Card>
      )}

      {globalSubjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {globalSubjects.map(renderSubjectCard)}
        </div>
      )}

      <AlertDialog open={!!deletingSubject} onOpenChange={() => setDeletingSubject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disciplina?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deletingSubject?.name}? Esta ação não pode ser desfeita.
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

      <SubjectsBulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
    </div>
  );
};

const Subjects = () => (
  <DashboardLayout>
    <SchoolMappingProvider>
      <SubjectsContent />
    </SchoolMappingProvider>
  </DashboardLayout>
);

export default Subjects;
