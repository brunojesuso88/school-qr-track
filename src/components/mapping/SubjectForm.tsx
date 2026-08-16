import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useSchoolMapping, MappingGlobalSubject } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_SERIES_OPTIONS, HighSchoolSeries, SERIES_VALUES, normalizeSeriesList } from "@/lib/series";

interface SubjectFormProps {
  subject?: MappingGlobalSubject | null;
  onClose: () => void;
}

const parseAliases = (value: string) =>
  [...new Set(value.split(/[\n;,]+/).map((a) => a.trim()).filter(Boolean))];

const SubjectForm = ({ subject, onClose }: SubjectFormProps) => {
  const { addGlobalSubject, updateGlobalSubject, refreshData } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(subject?.name || "");
  const [abbreviation, setAbbreviation] = useState(subject?.abbreviation || "");
  const [defaultWeeklyClasses, setDefaultWeeklyClasses] = useState(
    subject?.default_weekly_classes?.toString() || "4"
  );
  const [aliasesText, setAliasesText] = useState((subject?.aliases ?? []).join("\n"));
  // Sempre trabalhamos com o valor persistido ('1' | '2' | '3'); rótulos legados são convertidos na leitura.
  const [series, setSeries] = useState<HighSchoolSeries[]>(normalizeSeriesList(subject?.series));
  const [loading, setLoading] = useState(false);

  const toggleSeries = (value: HighSchoolSeries) =>
    setSeries((prev) => (prev.includes(value)
      ? prev.filter((s) => s !== value)
      : SERIES_VALUES.filter((v) => v === value || prev.includes(v))));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        abbreviation: abbreviation.trim() ? abbreviation.trim().toUpperCase() : null,
        default_weekly_classes: parseInt(defaultWeeklyClasses),
        aliases: parseAliases(aliasesText),
        series, // persistido apenas como '1' | '2' | '3'
      };

      if (subject) {
        const previous = subject.default_weekly_classes;
        await updateGlobalSubject(subject.id, data);

        // Propagate the new default to every existing class_subject row
        // so the "Disciplinas" tab and the "Distribuição" tab never diverge.
        let propagated = 0;
        if (data.default_weekly_classes !== previous) {
          const { data: updated, error } = await supabase
            .from("mapping_class_subjects")
            .update({ weekly_classes: data.default_weekly_classes })
            .eq("subject_name", subject.name)
            .select("id");
          if (!error) {
            propagated = updated?.length || 0;
            // teacher current_hours is recomputed inside refreshData()
            await refreshData();
          }
        }

        toast({
          title: "Disciplina atualizada com sucesso",
          description:
            propagated > 0
              ? `${propagated} turma(s) sincronizada(s) com o novo padrão.`
              : undefined,
        });
      } else {
        await addGlobalSubject(data);
        toast({ title: "Disciplina cadastrada com sucesso" });
      }
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Disciplina *</Label>
        <Input
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Matemática"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="abbreviation">Abreviação</Label>
        <Input
          id="abbreviation"
          value={abbreviation}
          onChange={e => setAbbreviation(e.target.value.slice(0, 10))}
          placeholder="Ex: MAT"
          maxLength={10}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Permite identificar a disciplina por uma sigla curta (até 10 caracteres).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weekly">Aulas por Semana (padrão)</Label>
        <Input
          id="weekly"
          type="number"
          min="1"
          max="20"
          value={defaultWeeklyClasses}
          onChange={e => setDefaultWeeklyClasses(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aliases">Nomes equivalentes no boletim (aliases)</Label>
        <Textarea
          id="aliases"
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
          placeholder={"Um por linha. Ex:\nLÍNGUA PORTUGUESA\nPORTUGUES"}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Usado na leitura de boletins em PDF: quando o boletim escreve a disciplina de outra forma, o alias evita
          divergências falsas. {parseAliases(aliasesText).length} alias(es) cadastrado(s).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Séries em que compõe a matriz padrão</Label>
        <div className="flex flex-wrap gap-3">
          {CLASS_SERIES_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={series.includes(option.value)}
                onCheckedChange={() => toggleSeries(option.value)}
              />
              {option.label}
            </label>
          ))}
          {series.length === 0 && (
            <Badge variant="outline" className="text-[10px]">Nenhuma série vinculada</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Turmas com série definida herdam estas disciplinas como âncoras na leitura do boletim.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : subject ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default SubjectForm;
