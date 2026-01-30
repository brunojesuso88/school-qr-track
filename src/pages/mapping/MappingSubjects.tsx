import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchoolMappingProvider, useSchoolMapping, MappingGlobalSubject } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SubjectForm from "@/components/mapping/SubjectForm";
import { useToast } from "@/hooks/use-toast";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";

const MappingSubjectsContent = () => {
  const { globalSubjects, deleteGlobalSubject, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<MappingGlobalSubject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<MappingGlobalSubject | null>(null);

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

  const handleEdit = (subject: MappingGlobalSubject) => {
    setEditingSubject(subject);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSubject(null);
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

  const renderSubjectCard = (subject: MappingGlobalSubject) => (
    <Card key={subject.id}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold">{subject.name}</h3>
            <Badge variant="secondary">
              {subject.default_weekly_classes} aulas/semana
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(subject)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-destructive"
              onClick={() => setDeletingSubject(subject)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Disciplinas</h1>
            <p className="text-muted-foreground">{globalSubjects.length} disciplinas cadastradas</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSubject(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSubject ? "Editar Disciplina" : "Nova Disciplina"}
                </DialogTitle>
              </DialogHeader>
              <SubjectForm subject={editingSubject} onClose={handleCloseDialog} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Empty State */}
        {globalSubjects.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma disciplina cadastrada</p>
            <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeira disciplina
            </Button>
          </Card>
        )}

        {/* Subjects List - Simple grid without shift grouping */}
        {globalSubjects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {globalSubjects.map(renderSubjectCard)}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
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
    </SchoolMappingLayout>
  );
};

const MappingSubjects = () => {
  return (
    <SchoolMappingProvider>
      <MappingSubjectsContent />
    </SchoolMappingProvider>
  );
};

export default MappingSubjects;
