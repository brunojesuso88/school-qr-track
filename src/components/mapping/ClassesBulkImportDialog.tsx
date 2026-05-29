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

interface ExtractedSubject {
  name: string;
  weekly_classes: number | null;
  teacher_name: string | null;
  teacher_abbreviation: string | null;
}

interface ExtractedClass {
  name: string;
  shift: string | null;
  subjects: ExtractedSubject[];
  selected: boolean;
  matchedClassId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const norm = (s: string) => s.trim().toLowerCase();

const SHIFT_LABEL: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

const ClassesBulkImportDialog = ({ open, onOpenChange }: Props) => {
  const { classes, teachers, globalSubjects, classSubjects, refreshData } = useSchoolMapping();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [extracted, setExtracted] = useState<ExtractedClass[]>([]);
  const [newSubjects, setNewSubjects] = useState<{ name: string; selected: boolean }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  const matchTeacher = (name?: string | null, abbr?: string | null) => {
    const n = norm(name || "");
    const a = (abbr || "").trim().toLowerCase();
    if (!n && !a) return null;
    return teachers.find((t) => {
      const en = norm(t.name);
      const ea = (t.abbreviation || "").trim().toLowerCase();
      return (
        (n && en === n) ||
        (a && ea && ea === a) ||
        (a && en === a) ||
        (n && ea && ea === n)
      );
    }) || null;
  };

  const resolveSubjectName = (mention: string) => {
    const m = mention.trim().toLowerCase();
    const found = globalSubjects.find(
      (gs) => norm(gs.name) === m || (gs.abbreviation || "").toLowerCase() === m
    );
    return found ? found.name : mention.trim();
  };

  const subjectExists = (mention: string) => {
    const m = mention.trim().toLowerCase();
    return globalSubjects.some(
      (gs) => norm(gs.name) === m || (gs.abbreviation || "").toLowerCase() === m
    );
  };

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

      const { data, error } = await supabase.functions.invoke("parse-classes-pdf", {
        body: { pdfBase64: base64 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao processar PDF");

      const result: ExtractedClass[] = (data.classes || []).map((c: any) => {
        const matched = classes.find((mc) => norm(mc.name) === norm(c.name));
        return {
          name: String(c.name || "").trim(),
          shift: c.shift || null,
          subjects: (c.subjects || []).map((s: any) => ({
            name: String(s.name || "").trim(),
            weekly_classes: s.weekly_classes || null,
            teacher_name: s.teacher_name || null,
            teacher_abbreviation: s.teacher_abbreviation || null,
          })),
          selected: true,
          matchedClassId: matched?.id ?? null,
        };
      });

      if (result.length === 0) {
        toast({ title: "Nenhuma turma encontrada no PDF", variant: "destructive" });
        setStep("upload");
        return;
      }

      // Identificar disciplinas mencionadas que não existem
      const mentioned = new Set<string>();
      result.forEach((c) => c.subjects.forEach((s) => mentioned.add(s.name)));
      const newList: { name: string; selected: boolean }[] = [];
      mentioned.forEach((m) => {
        if (m && !subjectExists(m)) newList.push({ name: m, selected: true });
      });
      setNewSubjects(newList);

      setExtracted(result);
      setStep("review");
    } catch (err: any) {
      console.error("Error processing classes PDF:", err);
      toast({ title: "Erro ao processar PDF", description: err.message, variant: "destructive" });
      setStep("upload");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleClass = (i: number) =>
    setExtracted((prev) => prev.map((c, idx) => (idx === i ? { ...c, selected: !c.selected } : c)));
  const toggleAll = () => {
    const all = extracted.every((c) => c.selected);
    setExtracted((prev) => prev.map((c) => ({ ...c, selected: !all })));
  };
  const toggleNewSubject = (i: number) =>
    setNewSubjects((prev) => prev.map((s, idx) => (idx === i ? { ...s, selected: !s.selected } : s)));

  const handleSave = async () => {
    const selected = extracted.filter((c) => c.selected);
    if (selected.length === 0) {
      toast({ title: "Selecione pelo menos uma turma", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // 1) Criar disciplinas globais novas selecionadas
      const subjToCreate = newSubjects.filter((s) => s.selected);
      let createdSubjCount = 0;
      if (subjToCreate.length > 0) {
        const { error } = await supabase
          .from("mapping_global_subjects")
          .insert(subjToCreate.map((s) => ({ name: s.name, default_weekly_classes: 4 })));
        if (!error) createdSubjCount = subjToCreate.length;
      }

      // 2) Criar turmas novas
      const classNameToId = new Map<string, string>();
      classes.forEach((c) => classNameToId.set(norm(c.name), c.id));

      const classesToInsert = selected
        .filter((c) => !c.matchedClassId)
        .map((c) => {
          const shift = c.shift || "morning";
          return {
            name: c.name,
            shift,
            weekly_hours: shift === "evening" ? 25 : 30,
            student_count: null as number | null,
          };
        });

      let createdClassesCount = 0;
      if (classesToInsert.length > 0) {
        const { data, error } = await supabase
          .from("mapping_classes")
          .insert(classesToInsert)
          .select("id, name");
        if (error) throw error;
        (data || []).forEach((c) => classNameToId.set(norm(c.name), c.id));
        createdClassesCount = data?.length || 0;
      }

      // 3) Criar professores novos (únicos por nome/abreviação no PDF que não casam)
      type NewT = { name: string; abbreviation: string | null };
      const newTeachersMap = new Map<string, NewT>(); // key: norm name or abbr
      const teacherKeyToId = new Map<string, string>(); // resolve mention -> teacher id

      for (const c of selected) {
        for (const s of c.subjects) {
          if (!s.teacher_name && !s.teacher_abbreviation) continue;
          const existing = matchTeacher(s.teacher_name, s.teacher_abbreviation);
          const key = norm(s.teacher_name || s.teacher_abbreviation || "");
          if (existing) {
            teacherKeyToId.set(key, existing.id);
          } else if (key && !newTeachersMap.has(key)) {
            newTeachersMap.set(key, {
              name: (s.teacher_name || s.teacher_abbreviation || "").trim(),
              abbreviation: s.teacher_abbreviation || null,
            });
          }
        }
      }

      const usedColors = teachers.map((t) => t.color);
      const newTeachersArr = Array.from(newTeachersMap.entries());
      const teachersToInsert = newTeachersArr.map(([_, t], index) => {
        const allUsed = [...usedColors];
        for (let i = 0; i < index; i++) {
          const prev =
            TEACHER_COLORS.find((c) => !allUsed.includes(c)) ||
            TEACHER_COLORS[(teachers.length + i) % TEACHER_COLORS.length];
          allUsed.push(prev);
        }
        const color =
          TEACHER_COLORS.find((c) => !allUsed.includes(c)) ||
          TEACHER_COLORS[(teachers.length + index) % TEACHER_COLORS.length];
        return {
          name: t.name,
          abbreviation: t.abbreviation,
          max_weekly_hours: 20,
          current_hours: 0,
          color,
        };
      });

      let createdTeachersCount = 0;
      if (teachersToInsert.length > 0) {
        const { data, error } = await supabase
          .from("mapping_teachers")
          .insert(teachersToInsert)
          .select("id, name, abbreviation");
        if (error) throw error;
        (data || []).forEach((t, i) => {
          const [key] = newTeachersArr[i];
          teacherKeyToId.set(key, t.id);
        });
        createdTeachersCount = data?.length || 0;
      }

      // 4) Para cada turma×disciplina: upsert em mapping_class_subjects
      // Fetch existing class_subjects para as turmas envolvidas em uma query
      const involvedClassIds = selected
        .map((c) => classNameToId.get(norm(c.name)))
        .filter((x): x is string => !!x);

      let existingMap = new Map<string, { id: string; subject_name: string }[]>();
      if (involvedClassIds.length > 0) {
        const { data: existing } = await supabase
          .from("mapping_class_subjects")
          .select("id, class_id, subject_name")
          .in("class_id", involvedClassIds);
        (existing || []).forEach((row: any) => {
          const list = existingMap.get(row.class_id) || [];
          list.push({ id: row.id, subject_name: row.subject_name });
          existingMap.set(row.class_id, list);
        });
      }

      const toInsertCS: any[] = [];
      const toUpdateCS: { id: string; teacher_id: string | null; weekly_classes: number }[] = [];
      let assignmentCount = 0;

      for (const c of selected) {
        const classId = classNameToId.get(norm(c.name));
        if (!classId) continue;
        const existingList = existingMap.get(classId) || [];
        for (const s of c.subjects) {
          const canonical = resolveSubjectName(s.name);
          const globalDefault = globalSubjects.find(
            (gs) => norm(gs.name) === norm(canonical)
          )?.default_weekly_classes;
          const weekly =
            s.weekly_classes && s.weekly_classes > 0
              ? s.weekly_classes
              : globalDefault && globalDefault > 0
              ? globalDefault
              : 4;
          const teacherKey = norm(s.teacher_name || s.teacher_abbreviation || "");
          const teacherId = teacherKey ? teacherKeyToId.get(teacherKey) || null : null;

          const existingRow = existingList.find(
            (r) => norm(r.subject_name) === norm(canonical)
          );
          if (existingRow) {
            toUpdateCS.push({ id: existingRow.id, teacher_id: teacherId, weekly_classes: weekly });
          } else {
            toInsertCS.push({
              class_id: classId,
              subject_name: canonical,
              weekly_classes: weekly,
              teacher_id: teacherId,
            });
          }
          if (teacherId) assignmentCount++;
        }
      }

      if (toInsertCS.length > 0) {
        const { error } = await supabase.from("mapping_class_subjects").insert(toInsertCS);
        if (error) throw error;
      }
      for (const u of toUpdateCS) {
        const { error } = await supabase
          .from("mapping_class_subjects")
          .update({ teacher_id: u.teacher_id, weekly_classes: u.weekly_classes })
          .eq("id", u.id);
        if (error) console.error("Erro ao atualizar class_subject", u.id, error);
      }

      await refreshData();

      const parts: string[] = [];
      parts.push(`${selected.length} turma(s)`);
      if (createdClassesCount > 0) parts.push(`${createdClassesCount} nova(s)`);
      parts.push(`${toInsertCS.length + toUpdateCS.length} disciplina(s)`);
      if (createdTeachersCount > 0) parts.push(`${createdTeachersCount} professor(es) novo(s)`);
      if (createdSubjCount > 0) parts.push(`${createdSubjCount} disciplina(s) global(is)`);
      if (assignmentCount > 0) parts.push(`${assignmentCount} atribuição(ões)`);
      toast({ title: "Importação concluída", description: parts.join(" · ") });
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setExtracted([]);
    setNewSubjects([]);
    setFileName("");
    onOpenChange(false);
  };

  const selectedCount = extracted.filter((c) => c.selected).length;
  const newClassCount = extracted.filter((c) => c.selected && !c.matchedClassId).length;
  const updateClassCount = extracted.filter((c) => c.selected && !!c.matchedClassId).length;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Adicionar em Lote por PDF</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Envie um PDF com a grade horária ou distribuição de turmas. A IA extrai as turmas, suas
              disciplinas e os professores responsáveis, casando automaticamente com cadastros existentes.
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
            <p className="text-xs text-muted-foreground">A IA está extraindo turmas, disciplinas e professores</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{newClassCount} turma(s) nova(s)</Badge>
                <Badge variant="secondary" className="text-[10px]">{updateClassCount} existente(s)</Badge>
                {newSubjects.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {newSubjects.filter((s) => s.selected).length}/{newSubjects.length} disciplina(s) nova(s)
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {extracted.every((c) => c.selected) ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>

            <ScrollArea className="h-[50vh]">
              <div className="space-y-3 pr-4">
                {extracted.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-colors ${
                      c.selected ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={c.selected}
                        onCheckedChange={() => toggleClass(idx)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{c.name}</p>
                          {c.shift && (
                            <Badge variant="outline" className="text-[10px]">
                              {SHIFT_LABEL[c.shift] || c.shift}
                            </Badge>
                          )}
                          {c.matchedClassId ? (
                            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500/90">
                              Atualizar
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500/90">
                              Nova
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {c.subjects.length} disciplina(s)
                          </Badge>
                        </div>

                        <ul className="mt-2 space-y-1">
                          {c.subjects.map((s, si) => {
                            const t = matchTeacher(s.teacher_name, s.teacher_abbreviation);
                            const subjExists = subjectExists(s.name);
                            return (
                              <li
                                key={si}
                                className="text-xs flex items-center gap-2 flex-wrap"
                              >
                                <span className="font-medium">{resolveSubjectName(s.name)}</span>
                                {!subjExists && (
                                  <Badge variant="outline" className="text-[9px]">nova disc.</Badge>
                                )}
                                {s.weekly_classes && (
                                  <span className="text-muted-foreground">
                                    · {s.weekly_classes}h
                                  </span>
                                )}
                                <span className="text-muted-foreground">→</span>
                                {s.teacher_name || s.teacher_abbreviation ? (
                                  <>
                                    <span>{s.teacher_name || s.teacher_abbreviation}</span>
                                    {t ? (
                                      <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                        Existente
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                                        Novo
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground italic">sem professor</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}

                {newSubjects.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Disciplinas globais a criar (desmarque para ignorar):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {newSubjects.map((s, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-1.5 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={s.selected}
                            onCheckedChange={() => toggleNewSubject(i)}
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving || selectedCount === 0}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {selectedCount} turma(s)
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassesBulkImportDialog;