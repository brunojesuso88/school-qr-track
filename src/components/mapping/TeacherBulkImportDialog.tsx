import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileText } from "lucide-react";
import { useSchoolMapping, TEACHER_COLORS } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExtractedTeacher {
  name: string;
  abbreviation: string;
  email: string;
  phone: string;
  max_weekly_hours: number;
  classes: string[];
  subjects: string[];
  selected: boolean;
  matchedTeacherId?: string | null;
  matchedTeacherName?: string | null;
}

interface TeacherBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const norm = (s: string) => s.trim().toLowerCase();

const TeacherBulkImportDialog = ({ open, onOpenChange }: TeacherBulkImportDialogProps) => {
  const { teachers, globalSubjects, refreshData } = useSchoolMapping();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [extractedTeachers, setExtractedTeachers] = useState<ExtractedTeacher[]>([]);
  const [newSubjects, setNewSubjects] = useState<{ name: string; selected: boolean }[]>([]);
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

      const extracted: ExtractedTeacher[] = (data.teachers || []).map((t: any) => {
        const name = String(t.name || "").trim();
        const abbr = String(t.abbreviation || "").trim().toUpperCase();
        // Match contra professores existentes por nome ou abreviação
        const match = teachers.find(existing => {
          const en = norm(existing.name);
          const ea = (existing.abbreviation || "").trim().toLowerCase();
          const n = norm(name);
          const a = abbr.toLowerCase();
          return (
            (n && en === n) ||
            (a && ea && ea === a) ||
            (a && en === a) ||
            (n && ea && ea === n)
          );
        });
        return {
          name,
          abbreviation: abbr,
          email: t.email || "",
          phone: t.phone || "",
          max_weekly_hours: t.max_weekly_hours || 20,
          classes: Array.isArray(t.classes) ? t.classes : [],
          subjects: Array.isArray(t.subjects) ? t.subjects : [],
          selected: true,
          matchedTeacherId: match?.id ?? null,
          matchedTeacherName: match?.name ?? null,
        };
      });

      if (extracted.length === 0) {
        toast({ title: "Nenhum professor encontrado no PDF", variant: "destructive" });
        setStep("upload");
        return;
      }

      // Identificar disciplinas novas mencionadas no PDF
      const allMentioned = new Set<string>();
      extracted.forEach(t => t.subjects.forEach(s => allMentioned.add(s.trim())));
      const newSubjList: { name: string; selected: boolean }[] = [];
      allMentioned.forEach(s => {
        if (!s) return;
        const sl = s.toLowerCase();
        const exists = globalSubjects.some(gs =>
          norm(gs.name) === sl ||
          (gs.abbreviation || "").toLowerCase() === sl
        );
        if (!exists) newSubjList.push({ name: s, selected: true });
      });
      setNewSubjects(newSubjList);

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

  const toggleNewSubject = (index: number) => {
    setNewSubjects(prev => prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s)));
  };

  // Resolve um nome/abreviação mencionada para o nome canônico de uma disciplina existente
  const resolveSubjectName = (mention: string): string => {
    const m = mention.trim().toLowerCase();
    const found = globalSubjects.find(gs =>
      norm(gs.name) === m || (gs.abbreviation || "").toLowerCase() === m
    );
    return found ? found.name : mention.trim();
  };

  const handleSave = async () => {
    const selected = extractedTeachers.filter(t => t.selected);
    if (selected.length === 0) {
      toast({ title: "Selecione pelo menos um professor", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      // 1) Criar disciplinas novas (selecionadas)
      const subjectsToCreate = newSubjects.filter(s => s.selected);
      let createdSubjectsCount = 0;
      if (subjectsToCreate.length > 0) {
        const { error: subjErr } = await supabase
          .from("mapping_global_subjects")
          .insert(subjectsToCreate.map(s => ({ name: s.name, default_weekly_classes: 4 })));
        if (subjErr) console.error("Erro ao criar disciplinas:", subjErr);
        else createdSubjectsCount = subjectsToCreate.length;
      }

      // 2) Separar novos vs atualizações
      const toInsert = selected.filter(t => !t.matchedTeacherId);
      const toUpdate = selected.filter(t => !!t.matchedTeacherId);

      // 3) Insert novos professores
      const usedColors = teachers.map(t => t.color);
      const teachersToInsert = toInsert.map((t, index) => {
        const allUsed = [...usedColors];
        for (let i = 0; i < index; i++) {
          const prevColor = TEACHER_COLORS.find(c => !allUsed.includes(c)) ||
            TEACHER_COLORS[(teachers.length + i) % TEACHER_COLORS.length];
          allUsed.push(prevColor);
        }
        const color = TEACHER_COLORS.find(c => !allUsed.includes(c)) ||
          TEACHER_COLORS[(teachers.length + index) % TEACHER_COLORS.length];

        const resolvedSubjects = Array.from(new Set(t.subjects.map(resolveSubjectName))).filter(Boolean);

        return {
          name: t.name,
          abbreviation: t.abbreviation || null,
          email: t.email || null,
          phone: t.phone || null,
          max_weekly_hours: t.max_weekly_hours,
          current_hours: 0,
          color,
          subjects: resolvedSubjects,
        };
      });

      let insertedTeachers: { id: string; name: string }[] = [];
      if (teachersToInsert.length > 0) {
        const { data, error } = await supabase
          .from("mapping_teachers")
          .insert(teachersToInsert)
          .select("id, name");
        if (error) throw error;
        insertedTeachers = data || [];
      }

      // 4) Update professores existentes (apenas campos preenchidos; mesclar subjects)
      let updatedCount = 0;
      for (const t of toUpdate) {
        const existing = teachers.find(e => e.id === t.matchedTeacherId);
        if (!existing) continue;
        const patch: Record<string, any> = {};
        if (t.abbreviation && t.abbreviation !== (existing.abbreviation || "")) patch.abbreviation = t.abbreviation;
        if (t.email && t.email !== (existing.email || "")) patch.email = t.email;
        if (t.phone && t.phone !== (existing.phone || "")) patch.phone = t.phone;
        if (t.max_weekly_hours && t.max_weekly_hours !== existing.max_weekly_hours) patch.max_weekly_hours = t.max_weekly_hours;

        // Mesclar disciplinas: união sem duplicar (normalizando para nome canônico)
        if (t.subjects.length > 0) {
          const existingSubjects = (existing as any).subjects as string[] | undefined || [];
          const resolved = t.subjects.map(resolveSubjectName);
          const merged = Array.from(new Set([...existingSubjects, ...resolved].map(s => s.trim()).filter(Boolean)));
          patch.subjects = merged;
        }

        if (Object.keys(patch).length === 0) continue;
        const { error: upErr } = await supabase
          .from("mapping_teachers")
          .update(patch)
          .eq("id", t.matchedTeacherId!);
        if (upErr) {
          console.error("Erro ao atualizar professor", t.name, upErr);
        } else {
          updatedCount++;
        }
      }

      // Batch class assignments
      let classAssignCount = 0;
      
      // Mapa: nome extraído -> teacher_id (novos + atualizações)
      const teacherIdMap = new Map<string, string>();
      insertedTeachers.forEach(t => teacherIdMap.set(t.name, t.id));
      toUpdate.forEach(t => {
        if (t.matchedTeacherId) teacherIdMap.set(t.name, t.matchedTeacherId);
      });

      // Collect all class names we need to look up
      const allClassNames = new Set<string>();
      selected.forEach(t => t.classes.forEach(c => allClassNames.add(c.trim())));

      if (allClassNames.size > 0) {
        // Fetch all matching classes in one query
        const { data: allMatchedClasses } = await supabase
          .from("mapping_classes")
          .select("id, name");

        if (allMatchedClasses && allMatchedClasses.length > 0) {
          // Build class name -> id map (case-insensitive)
          const classIdMap = new Map<string, string>();
          allMatchedClasses.forEach(c => classIdMap.set(c.name.toLowerCase(), c.id));

          // Fetch all unassigned class subjects in one query
          const classIds = allMatchedClasses.map(c => c.id);
          const { data: allUnassigned } = await supabase
            .from("mapping_class_subjects")
            .select("id, class_id")
            .in("class_id", classIds)
            .is("teacher_id", null);

          if (allUnassigned && allUnassigned.length > 0) {
            // Group unassigned by class_id
            const unassignedByClass = new Map<string, string[]>();
            allUnassigned.forEach(u => {
              const list = unassignedByClass.get(u.class_id!) || [];
              list.push(u.id);
              unassignedByClass.set(u.class_id!, list);
            });

            // For each teacher, assign to their classes' unassigned subjects
            for (const t of selected) {
              const teacherId = teacherIdMap.get(t.name);
              if (!teacherId || t.classes.length === 0) continue;

              for (const className of t.classes) {
                const classId = classIdMap.get(className.trim().toLowerCase());
                if (!classId) continue;

                const subjectIds = unassignedByClass.get(classId);
                if (!subjectIds || subjectIds.length === 0) continue;

                // Update all unassigned subjects for this class
                const { error: assignError } = await supabase
                  .from("mapping_class_subjects")
                  .update({ teacher_id: teacherId })
                  .in("id", subjectIds);

                if (!assignError) {
                  classAssignCount += subjectIds.length;
                  // Remove from map so next teacher doesn't get the same subjects
                  unassignedByClass.delete(classId);
                }
              }
            }
          }
        }
      }

      // Single refresh at the end
      await refreshData();

      const parts: string[] = [];
      if (insertedTeachers.length > 0) parts.push(`${insertedTeachers.length} novo(s)`);
      if (updatedCount > 0) parts.push(`${updatedCount} atualizado(s)`);
      if (createdSubjectsCount > 0) parts.push(`${createdSubjectsCount} disciplina(s) nova(s)`);
      if (classAssignCount > 0) parts.push(`${classAssignCount} atribuição(ões) de turma`);
      toast({ title: parts.length > 0 ? parts.join(" · ") : "Nada a salvar" });
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
    setNewSubjects([]);
    setFileName("");
    onOpenChange(false);
  };

  const selectedCount = extractedTeachers.filter(t => t.selected).length;
  const newCount = extractedTeachers.filter(t => t.selected && !t.matchedTeacherId).length;
  const updateCount = extractedTeachers.filter(t => t.selected && !!t.matchedTeacherId).length;
  const newSubjCount = newSubjects.filter(s => s.selected).length;

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
              Envie um PDF com a lista de professores. A IA extrai nomes, abreviações e disciplinas, casa com cadastros existentes e permite atualizá-los.
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
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{newCount} novo(s)</Badge>
                <Badge variant="secondary" className="text-[10px]">{updateCount} atualização(ões)</Badge>
                {newSubjects.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">{newSubjCount}/{newSubjects.length} disciplina(s) nova(s)</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {extractedTeachers.every(t => t.selected) ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="h-[45vh]">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{teacher.name}</p>
                        {teacher.abbreviation && (
                          <Badge variant="outline" className="text-[10px] font-mono">{teacher.abbreviation}</Badge>
                        )}
                        {teacher.matchedTeacherId ? (
                          <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500/90">
                            Atualizar: {teacher.matchedTeacherName}
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500/90">Novo</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.email && (
                          <Badge variant="outline" className="text-[10px]">{teacher.email}</Badge>
                        )}
                        {teacher.phone && (
                          <Badge variant="outline" className="text-[10px]">{teacher.phone}</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">{teacher.max_weekly_hours}h/sem</Badge>
                      </div>
                      {teacher.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {teacher.subjects.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      )}
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

                {newSubjects.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Disciplinas novas detectadas no PDF
                    </p>
                    <div className="space-y-1">
                      {newSubjects.map((s, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 p-2 rounded border ${
                            s.selected ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                          }`}
                        >
                          <Checkbox
                            checked={s.selected}
                            onCheckedChange={() => toggleNewSubject(i)}
                          />
                          <span className="text-sm">{s.name}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">criar</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  `Salvar ${selectedCount} professor(es)`
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
