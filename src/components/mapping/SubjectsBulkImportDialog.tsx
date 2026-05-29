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

interface ExtractedSubject {
  name: string;
  abbreviation: string;
  default_weekly_classes: number;
  selected: boolean;
  matchedId?: string | null;
  matchedName?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const norm = (s: string) => s.trim().toLowerCase();

const SubjectsBulkImportDialog = ({ open, onOpenChange }: Props) => {
  const { globalSubjects, refreshData } = useSchoolMapping();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [extracted, setExtracted] = useState<ExtractedSubject[]>([]);
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

      const { data, error } = await supabase.functions.invoke("parse-subjects-pdf", {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao processar PDF");

      const seen = new Set<string>();
      const items: ExtractedSubject[] = [];
      for (const s of data.subjects || []) {
        const name = String(s.name || "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const abbr = String(s.abbreviation || "").trim();
        const match = globalSubjects.find(gs => {
          const gn = norm(gs.name);
          const ga = (gs.abbreviation || "").toLowerCase();
          const n = norm(name);
          const a = abbr.toLowerCase();
          return (n && gn === n) || (a && ga && ga === a) || (a && gn === a) || (n && ga && ga === n);
        });
        items.push({
          name,
          abbreviation: abbr,
          default_weekly_classes: Number(s.default_weekly_classes) || 4,
          selected: !match,
          matchedId: match?.id ?? null,
          matchedName: match?.name ?? null,
        });
      }

      if (items.length === 0) {
        toast({ title: "Nenhuma disciplina encontrada no PDF", variant: "destructive" });
        setStep("upload");
        return;
      }

      setExtracted(items);
      setStep("review");
    } catch (err: any) {
      console.error("Error processing PDF:", err);
      toast({ title: "Erro ao processar PDF", description: err.message, variant: "destructive" });
      setStep("upload");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggle = (i: number) =>
    setExtracted(prev => prev.map((s, idx) => (idx === i ? { ...s, selected: !s.selected } : s)));

  const toggleAll = () => {
    const allSel = extracted.every(s => s.selected);
    setExtracted(prev => prev.map(s => ({ ...s, selected: !allSel })));
  };

  const handleSave = async () => {
    const toInsert = extracted.filter(s => s.selected && !s.matchedId);
    const toUpdate = extracted.filter(s => s.selected && s.matchedId);

    if (toInsert.length === 0 && toUpdate.length === 0) {
      toast({ title: "Selecione pelo menos uma disciplina", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let inserted = 0;
      let updated = 0;

      if (toInsert.length > 0) {
        const { error } = await supabase.from("mapping_global_subjects").insert(
          toInsert.map(s => ({
            name: s.name,
            abbreviation: s.abbreviation || null,
            default_weekly_classes: s.default_weekly_classes,
          }))
        );
        if (error) throw error;
        inserted = toInsert.length;
      }

      for (const s of toUpdate) {
        const existing = globalSubjects.find(g => g.id === s.matchedId);
        if (!existing) continue;
        const patch: Record<string, any> = {};
        if (s.abbreviation && s.abbreviation !== (existing.abbreviation || "")) {
          patch.abbreviation = s.abbreviation;
        }
        if (Object.keys(patch).length === 0) continue;
        const { error } = await supabase
          .from("mapping_global_subjects")
          .update(patch)
          .eq("id", s.matchedId!);
        if (!error) updated++;
      }

      await refreshData();

      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} nova(s)`);
      if (updated > 0) parts.push(`${updated} atualizada(s)`);
      toast({ title: parts.length > 0 ? parts.join(" · ") : "Nada a salvar" });
      handleClose();
    } catch (err: any) {
      toast({ title: "Erro ao salvar disciplinas", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setExtracted([]);
    setFileName("");
    onOpenChange(false);
  };

  const selectedCount = extracted.filter(s => s.selected).length;
  const newCount = extracted.filter(s => s.selected && !s.matchedId).length;
  const updateCount = extracted.filter(s => s.selected && s.matchedId).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importar Disciplinas em Lote</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Envie um PDF com a lista de disciplinas. A IA extrai nome e abreviação e cruza com as disciplinas já cadastradas.
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
            <p className="text-xs text-muted-foreground">A IA está extraindo as disciplinas</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{newCount} nova(s)</Badge>
                <Badge variant="secondary" className="text-[10px]">{updateCount} atualização(ões)</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {extracted.every(s => s.selected) ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="h-[45vh]">
              <div className="space-y-2 pr-4">
                {extracted.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      s.selected ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={s.selected}
                      onCheckedChange={() => toggle(i)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {s.abbreviation && (
                          <Badge variant="outline" className="text-[10px] font-mono">{s.abbreviation}</Badge>
                        )}
                        {s.matchedId ? (
                          <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500/90">
                            Existente: {s.matchedName}
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500/90">Nova</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {s.default_weekly_classes} aulas/sem
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving || selectedCount === 0}>
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  `Salvar ${selectedCount} disciplina(s)`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubjectsBulkImportDialog;