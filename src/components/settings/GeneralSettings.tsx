import { useEffect, useState } from 'react';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import { assertActiveSchool } from '@/lib/schools/scope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Check, ListFilter, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSchoolPreferences } from '@/hooks/useSchoolPreferences';
import {
  BIMESTER_LABELS,
  isValidAcademicYear,
  MAX_ACADEMIC_YEAR,
  MIN_ACADEMIC_YEAR,
  STUDENT_SORT_LABELS,
  STUDENT_SORT_OPTIONS,
  defaultSchoolPreferences,
  type SchoolPreferences,
} from '@/lib/settings/schoolPreferences';

/**
 * Preferências gerais da escola ativa (por `school_id`, nunca globais).
 * Horários limite por turno e sons de notificação não são mais expostos aqui;
 * as chaves legadas (`cutoff_*`, `realtime_sound_enabled`) permanecem no banco.
 */
const GeneralSettings = () => {
  const activeSchoolId = useActiveSchoolId();
  const { preferences, loading, refetch } = useSchoolPreferences();
  const [form, setForm] = useState<SchoolPreferences>(defaultSchoolPreferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(preferences);
  }, [preferences, activeSchoolId]);

  const handleSave = async () => {
    if (!isValidAcademicYear(Number(form.academic_year))) {
      toast.error(`Informe um ano letivo entre ${MIN_ACADEMIC_YEAR} e ${MAX_ACADEMIC_YEAR}.`);
      return;
    }
    setSaving(true);
    try {
      const schoolId = assertActiveSchool(activeSchoolId);
      const rows = [
        { key: 'academic_year', value: Number(form.academic_year) },
        { key: 'current_bimester', value: form.current_bimester },
        { key: 'show_inactive_students', value: form.show_inactive_students },
        { key: 'default_student_sort', value: form.default_student_sort },
      ].map((r) => ({ school_id: schoolId, key: r.key, value: r.value as never }));

      const { error } = await supabase
        .from('settings')
        .upsert(rows, { onConflict: 'school_id,key' });
      if (error) throw error;

      await refetch();
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving school preferences:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preferências gerais da escola</h2>
        <p className="text-sm text-muted-foreground">
          Contexto do período letivo e padrões de exibição, aplicados apenas à escola ativa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Período letivo
          </CardTitle>
          <CardDescription>
            Informação institucional exibida no painel inicial. Não altera notas, IRA nem frequência.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="academic-year">Ano letivo atual</Label>
            <Input
              id="academic-year"
              type="number"
              inputMode="numeric"
              min={MIN_ACADEMIC_YEAR}
              max={MAX_ACADEMIC_YEAR}
              value={form.academic_year}
              onChange={(e) => setForm((p) => ({ ...p, academic_year: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Entre {MIN_ACADEMIC_YEAR} e {MAX_ACADEMIC_YEAR}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-bimester">Bimestre atual</Label>
            <Select
              value={String(form.current_bimester)}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, current_bimester: Number(v) as SchoolPreferences['current_bimester'] }))
              }
            >
              <SelectTrigger id="current-bimester"><SelectValue /></SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4] as const).map((b) => (
                  <SelectItem key={b} value={String(b)}>{BIMESTER_LABELS[b]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Contexto operacional da escola.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListFilter className="h-5 w-5 text-primary" />
            Exibição e listagens
          </CardTitle>
          <CardDescription>Padrões iniciais da tela Alunos — o usuário ainda pode trocar nos filtros.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="show-inactive">Exibir alunos desistentes por padrão</Label>
              <p className="text-sm text-muted-foreground">
                Quando desativado, a tela Alunos abre mostrando apenas alunos ativos.
              </p>
            </div>
            <Switch
              id="show-inactive"
              checked={form.show_inactive_students}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, show_inactive_students: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-sort">Ordenação padrão da lista de alunos</Label>
            <Select
              value={form.default_student_sort}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, default_student_sort: v as SchoolPreferences['default_student_sort'] }))
              }
            >
              <SelectTrigger id="default-sort" className="sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STUDENT_SORT_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{STUDENT_SORT_LABELS[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !activeSchoolId}>
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
        ) : (
          <><Check className="mr-2 h-4 w-4" />Salvar configurações</>
        )}
      </Button>
    </div>
  );
};

export default GeneralSettings;
