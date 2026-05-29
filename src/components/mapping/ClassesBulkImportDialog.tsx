import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, FileText, AlertTriangle } from "lucide-react";
import { useSchoolMapping, TEACHER_COLORS } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExtractedSubject {
  name: string;
  weekly_classes: number | null;
  original_weekly_classes: number | null;
  double_periods: number;
  merged_from: number;
  teacher_name: string | null;
  teacher_abbreviation: string | null;
}

interface ExtractedClass {
  name: string;
  shift: string | null;
  notes: string | null;
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

  const getGlobalDefault = (mention: string): number | null => {
    const canonical = resolveSubjectName(mention);
    const found = globalSubjects.find((gs) => norm(gs.name) === norm(canonical));
    return found?.default_weekly_classes ?? null;
  };

  const getEffectiveWeekly = (s: ExtractedSubject): number => {
    if (s.weekly_classes && s.weekly_classes > 0) return s.weekly_classes;
    const gd = getGlobalDefault(s.name);
    return gd && gd > 0 ? gd : 4;
  };

  const getTargetHours = (c: ExtractedClass): number => {
    return (c.shift || "morning") === "evening" ? 25 : 30;
  };

  const getStoredHours = (c: ExtractedClass): number | null => {
    if (!c.matchedClassId) return null;
    const existing = classes.find((mc) => mc.id === c.matchedClassId);
    return existing?.weekly_hours ?? null;
  };

  const getClassSum = (c: ExtractedClass): number =>
    c.subjects.reduce((acc, s) => acc + getEffectiveWeekly(s), 0);

  const getSumStatus = (c: ExtractedClass): "ok" | "diff" | "over" => {
    const sum = getClassSum(c);
    const target = getTargetHours(c);
    if (sum === target) return "ok";
    if (sum > target) return "over";
    return "diff";
  };

  const getDivergenceReasons = (c: ExtractedClass): string[] => {
    const reasons: string[] = [];
    const sum = getClassSum(c);
    const target = getTargetHours(c);
    const merged = c.subjects.filter((s) => s.merged_from > 1).length;
    const missing = c.subjects.filter((s) => !s.weekly_classes || s.weekly_classes <= 0).length;
    const doubles = c.subjects.reduce((acc, s) => acc + (s.double_periods || 0), 0);
    const stored = getStoredHours(c);
    if (merged > 0) reasons.push(`${merged} disciplina(s) duplicada(s) consolidada(s) automaticamente`);
    if (missing > 0) reasons.push(`${missing} disciplina(s) sem carga no PDF (usando padrão)`);
    if (sum > target) reasons.push(`Sobrecarga: ${sum - target}h acima do alvo`);
    if (sum < target) reasons.push(`Subcarga: ${target - sum}h abaixo do alvo`);
    if (doubles > 0) reasons.push(`Aulas duplas detectadas: ${doubles}`);
    if (stored != null && stored !== target) reasons.push(`Cadastro da turma tem ${stored}h (padrão é ${target}h)`);
    if (sum !== target) reasons.push(`Carga semanal alvo: 30h (manhã/tarde) ou 25h (noite)`);
    return reasons;
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
        // Deduplicação: consolidar disciplinas repetidas na mesma turma
        const byCanonical = new Map<string, ExtractedSubject>();
        for (const s of c.subjects || []) {
          const rawName = String(s.name || "").trim();
          if (!rawName) continue;
          const canonical = resolveSubjectName(rawName);
          const key = norm(canonical);
          const wc = Number(s.weekly_classes) > 0 ? Number(s.weekly_classes) : null;
          const dp = Number(s.double_periods) > 0 ? Number(s.double_periods) : 0;
          const existing = byCanonical.get(key);
          if (existing) {
            const sumWc = (existing.weekly_classes || 0) + (wc || 0);
            existing.weekly_classes = sumWc > 0 ? sumWc : existing.weekly_classes;
            existing.original_weekly_classes = existing.weekly_classes;
            existing.double_periods += dp;
            existing.merged_from += 1;
            if (!existing.teacher_name && s.teacher_name) existing.teacher_name = s.teacher_name;
            if (!existing.teacher_abbreviation && s.teacher_abbreviation)
              existing.teacher_abbreviation = s.teacher_abbreviation;
          } else {
            byCanonical.set(key, {
              name: rawName,
              weekly_classes: wc,
              original_weekly_classes: wc,
              double_periods: dp,
              merged_from: 1,
              teacher_name: s.teacher_name || null,
              teacher_abbreviation: s.teacher_abbreviation || null,
            });
          }
        }
        return {
          name: String(c.name || "").trim(),
          shift: c.shift || null,
          notes: c.notes || null,
          subjects: Array.from(byCanonical.values()),
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

  const updateSubjectWeekly = (classIdx: number, subjectIdx: number, value: number) => {
    const v = Math.max(1, Math.min(20, Math.floor(value) || 1));
    setExtracted((prev) =>
      prev.map((c, ci) =>
        ci !== classIdx
          ? c
          : {
              ...c,
              subjects: c.subjects.map((s, si) =>
                si !== subjectIdx ? s : { ...s, weekly_classes: v }
              ),
            }
      )
    );
  };

  const distributeEvenly = (classIdx: number) => {
    setExtracted((prev) =>
      prev.map((c, ci) => {
        if (ci !== classIdx) return c;
        const target = getTargetHours(c);
        const n = c.subjects.length;
        if (n === 0) return c;
        const base = Math.floor(target / n);
        let remainder = target - base * n;
        return {
          ...c,
          subjects: c.subjects.map((s) => {
            const extra = remainder > 0 ? 1 : 0;
            if (extra) remainder--;
            return { ...s, weekly_classes: Math.max(1, base + extra) };
          }),
        };
      })
    );
  };

  const handleSave = async () => {
    const selected = extracted.filter((c) => c.selected);
    if (selected.length === 0) {
      toast({ title: "Selecione pelo menos uma turma", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // 0) Calcular consenso de weekly_classes por disciplina (canônica) a partir do PDF
      const subjectPdfValues = new Map<string, number[]>(); // canonical name -> [weekly_classes...]
      for (const c of selected) {
        for (const s of c.subjects) {
          if (!s.weekly_classes || s.weekly_classes <= 0) continue;
          const canonical = resolveSubjectName(s.name);
          const key = norm(canonical);
          const arr = subjectPdfValues.get(key) || [];
          arr.push(s.weekly_classes);
          subjectPdfValues.set(key, arr);
        }
      }
      const subjectConsensus = new Map<string, number | null>(); // null = conflito
      const conflicts: string[] = [];
      subjectPdfValues.forEach((vals, key) => {
        const unique = Array.from(new Set(vals));
        if (unique.length === 1) {
          subjectConsensus.set(key, unique[0]);
        } else {
          subjectConsensus.set(key, null);
          conflicts.push(key);
        }
      });

      const mostFrequent = (vals: number[]): number => {
        const count = new Map<number, number>();
        vals.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
        let best = vals[0];
        let max = 0;
        count.forEach((n, v) => {
          if (n > max) {
            max = n;
            best = v;
          }
        });
        return best;
      };

      // 1) Criar disciplinas globais novas selecionadas (usando consenso/mais frequente do PDF)
      const subjToCreate = newSubjects.filter((s) => s.selected);
      let createdSubjCount = 0;
      if (subjToCreate.length > 0) {
        const rows = subjToCreate.map((s) => {
          const key = norm(resolveSubjectName(s.name));
          const vals = subjectPdfValues.get(key) || [];
          const def = vals.length > 0 ? mostFrequent(vals) : 4;
          return { name: s.name, default_weekly_classes: def };
        });
        const { error } = await supabase
          .from("mapping_global_subjects")
          .insert(rows);
        if (!error) createdSubjCount = subjToCreate.length;
      }

      // 2) Criar turmas novas
      const classNameToId = new Map<string, string>();
      classes.forEach((c) => classNameToId.set(norm(c.name), c.id));

      const classesToInsert = selected
        .filter((c) => !c.matchedClassId)
        .map((c) => {
          const shift = c.shift || "morning";
          const pdfSum = getClassSum(c);
          return {
            name: c.name,
            shift,
            weekly_hours: pdfSum > 0 ? pdfSum : shift === "evening" ? 25 : 30,
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

      // 2b) Atualizar weekly_hours de turmas existentes quando o PDF diverge
      let updatedClassHoursCount = 0;
      for (const c of selected) {
        if (!c.matchedClassId) continue;
        const existing = classes.find((mc) => mc.id === c.matchedClassId);
        if (!existing) continue;
        const pdfSum = getClassSum(c);
        if (pdfSum > 0 && pdfSum !== existing.weekly_hours) {
          const { error } = await supabase
            .from("mapping_classes")
            .update({ weekly_hours: pdfSum })
            .eq("id", existing.id);
          if (error) console.error("Erro ao atualizar weekly_hours", existing.name, error);
          else updatedClassHoursCount++;
        }
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

      // 5) Atualizar default_weekly_classes nas disciplinas globais existentes
      // quando o PDF traz consenso diferente, e propagar para mapping_class_subjects.
      let updatedGlobalDefaults = 0;
      for (const [key, consensus] of subjectConsensus.entries()) {
        if (consensus == null) continue;
        const gs = globalSubjects.find((g) => norm(g.name) === key);
        if (!gs) continue; // novas já foram criadas com o valor correto
        if (gs.default_weekly_classes === consensus) continue;
        const { error: gErr } = await supabase
          .from("mapping_global_subjects")
          .update({ default_weekly_classes: consensus })
          .eq("id", gs.id);
        if (gErr) {
          console.error("Erro ao atualizar default global", gs.name, gErr);
          continue;
        }
        const { error: csErr } = await supabase
          .from("mapping_class_subjects")
          .update({ weekly_classes: consensus })
          .eq("subject_name", gs.name);
        if (csErr) console.error("Erro ao propagar weekly_classes", gs.name, csErr);
        updatedGlobalDefaults++;
      }

      await refreshData();

      const parts: string[] = [];
      parts.push(`${selected.length} turma(s)`);
      if (createdClassesCount > 0) parts.push(`${createdClassesCount} nova(s)`);
      parts.push(`${toInsertCS.length + toUpdateCS.length} disciplina(s)`);
      if (createdTeachersCount > 0) parts.push(`${createdTeachersCount} professor(es) novo(s)`);
      if (createdSubjCount > 0) parts.push(`${createdSubjCount} disciplina(s) global(is)`);
      if (updatedClassHoursCount > 0) parts.push(`${updatedClassHoursCount} carga(s) horária(s) de turma atualizada(s)`);
      if (updatedGlobalDefaults > 0) parts.push(`${updatedGlobalDefaults} padrão(ões) global(is) atualizado(s)`);
      if (conflicts.length > 0) parts.push(`${conflicts.length} disciplina(s) com conflito de carga (mantido por turma)`);
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
  const invalidCount = extracted.filter((c) => c.selected && getSumStatus(c) !== "ok").length;

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
                          {(() => {
                            const sum = getClassSum(c);
                            const target = getTargetHours(c);
                            const status = getSumStatus(c);
                            const cls =
                              status === "ok"
                                ? "bg-emerald-500 hover:bg-emerald-500/90"
                                : status === "over"
                                ? "bg-red-500 hover:bg-red-500/90"
                                : "bg-amber-500 hover:bg-amber-500/90";
                            return (
                              <Badge className={`text-[10px] ${cls}`}>
                                Soma: {sum}h / {target}h
                              </Badge>
                            );
                          })()}
                        </div>
                        {getSumStatus(c) !== "ok" && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Soma das aulas ({getClassSum(c)}h) difere da carga semanal da turma ({getTargetHours(c)}h).
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                distributeEvenly(idx);
                              }}
                            >
                              Distribuir igualmente
                            </Button>
                          </div>
                        )}

                        <ul className="mt-2 space-y-1">
                          {c.subjects.map((s, si) => {
                            const t = matchTeacher(s.teacher_name, s.teacher_abbreviation);
                            const subjExists = subjectExists(s.name);
                            const gd = getGlobalDefault(s.name);
                            const willUpdateDefault =
                              subjExists &&
                              s.weekly_classes != null &&
                              s.weekly_classes > 0 &&
                              gd != null &&
                              s.weekly_classes !== gd;
                            const edited =
                              s.weekly_classes != null &&
                              s.original_weekly_classes != null &&
                              s.weekly_classes !== s.original_weekly_classes;
                            return (
                              <li
                                key={si}
                                className="text-xs flex items-center gap-2 flex-wrap"
                              >
                                <span className="font-medium">{resolveSubjectName(s.name)}</span>
                                {!subjExists && (
                                  <Badge variant="outline" className="text-[9px]">nova disc.</Badge>
                                )}
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  ·
                                  <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={s.weekly_classes ?? ""}
                                    onChange={(e) =>
                                      updateSubjectWeekly(idx, si, parseInt(e.target.value, 10))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-6 w-14 px-1 text-xs"
                                  />
                                  <span className="text-[10px]">aulas/sem</span>
                                </span>
                                {edited && (
                                  <Badge variant="outline" className="text-[9px] border-sky-500/40 text-sky-600 dark:text-sky-400">
                                    editado ({s.original_weekly_classes ?? "?"}→{s.weekly_classes})
                                  </Badge>
                                )}
                                {willUpdateDefault && (
                                  <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                                    atualizar padrão ({gd}h→{s.weekly_classes}h)
                                  </Badge>
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
              <Button
                onClick={handleSave}
                disabled={isSaving || selectedCount === 0}
                title={invalidCount > 0 ? `${invalidCount} turma(s) terão a carga horária ajustada conforme o PDF` : undefined}
                variant={invalidCount > 0 ? "default" : "default"}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {invalidCount > 0
                  ? `Atualizar ${selectedCount} turma(s) conforme PDF`
                  : `Importar ${selectedCount} turma(s)`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassesBulkImportDialog;