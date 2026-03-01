import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileText } from "lucide-react";
import { useSchoolMapping } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExtractedTeacher {
  name: string;
  email: string;
  phone: string;
  max_weekly_hours: number;
  classes: string[];
  selected: boolean;
}

interface TeacherBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TeacherBulkImportDialog = ({ open, onOpenChange }: TeacherBulkImportDialogProps) => {
  const { addTeacher } = useSchoolMapping();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [extractedTeachers, setExtractedTeachers] = useState<ExtractedTeacher[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Selecione um arquivo PDF", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx. 10MB)", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    setStep("processing");

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-teachers-pdf", {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao processar PDF");

      const extracted: ExtractedTeacher[] = (data.teachers || []).map((t: any) => ({
        name: t.name || "",
        email: t.email || "",
        phone: t.phone || "",
        max_weekly_hours: t.max_weekly_hours || 20,
        classes: Array.isArray(t.classes) ? t.classes : [],
        selected: true,
      }));

      if (extracted.length === 0) {
        toast({ title: "Nenhum professor encontrado no PDF", variant: "destructive" });
        setStep("upload");
        return;
      }

      setExtractedTeachers(extracted);
      setStep("review");
    } catch (error: any) {
      console.error("Error processing PDF:", error);
      toast({ title: "Erro ao processar PDF", description: error.message, variant: "destructive" });
      setStep("upload");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleTeacher = (index: number) => {
    setExtractedTeachers(prev =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleAll = () => {
    const allSelected = extractedTeachers.every(t => t.selected);
    setExtractedTeachers(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  const handleSave = async () => {
    const selected = extractedTeachers.filter(t => t.selected);
    if (selected.length === 0) {
      toast({ title: "Selecione pelo menos um professor", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let classAssignCount = 0;

    try {
      for (const t of selected) {
        try {
          const result = await addTeacher({
            name: t.name,
            email: t.email || undefined,
            phone: t.phone || undefined,
            max_weekly_hours: t.max_weekly_hours,
            notes: undefined,
          });

          if (result?.id && t.classes.length > 0) {
            // Find matching classes and assign teacher to unassigned subjects
            for (const className of t.classes) {
              const { data: matchedClasses } = await supabase
                .from("mapping_classes")
                .select("id")
                .ilike("name", className.trim());

              if (matchedClasses && matchedClasses.length > 0) {
                for (const mc of matchedClasses) {
                  const { data: unassigned } = await supabase
                    .from("mapping_class_subjects")
                    .select("id")
                    .eq("class_id", mc.id)
                    .is("teacher_id", null);

                  if (unassigned && unassigned.length > 0) {
                    for (const subj of unassigned) {
                      await supabase
                        .from("mapping_class_subjects")
                        .update({ teacher_id: result.id })
                        .eq("id", subj.id);
                      classAssignCount++;
                    }
                  }
                }
              }
            }
          }

          successCount++;
        } catch (err: any) {
          console.error(`Error adding teacher ${t.name}:`, err);
        }
      }

      const msg = classAssignCount > 0
        ? `${successCount} professor(es) adicionado(s) e ${classAssignCount} disciplina(s) atribuída(s)!`
        : `${successCount} professor(es) adicionado(s) com sucesso!`;
      toast({ title: msg });
      handleClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar professores", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setExtractedTeachers([]);
    setFileName("");
    onOpenChange(false);
  };

  const selectedCount = extractedTeachers.filter(t => t.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importar Professores em Lote</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Envie um PDF com a lista de professores. O sistema usará IA para extrair os dados automaticamente.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" />
              Selecionar PDF
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando {fileName}...</p>
            <p className="text-xs text-muted-foreground">A IA está extraindo os dados dos professores</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                {extractedTeachers.length} professores encontrados
              </p>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {extractedTeachers.every(t => t.selected) ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="h-[40vh]">
              <div className="space-y-2 pr-4">
                {extractedTeachers.map((teacher, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      teacher.selected ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={teacher.selected}
                      onCheckedChange={() => toggleTeacher(index)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{teacher.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.email && (
                          <Badge variant="outline" className="text-[10px]">{teacher.email}</Badge>
                        )}
                        {teacher.phone && (
                          <Badge variant="outline" className="text-[10px]">{teacher.phone}</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">{teacher.max_weekly_hours}h/sem</Badge>
                      </div>
                      {teacher.classes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {teacher.classes.map((cls, i) => (
                            <Badge key={i} className="text-[10px]">{cls}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving || selectedCount === 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  `Adicionar ${selectedCount} professor(es)`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeacherBulkImportDialog;
