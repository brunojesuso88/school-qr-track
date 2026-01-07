import { useState, useEffect } from 'react';
import { TimetableProvider, useTimetable } from '@/contexts/TimetableContext';
import { SchoolMappingProvider } from '@/contexts/SchoolMappingContext';
import TimetableLayout from '@/components/timetable/TimetableLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

const SettingsContent = () => {
  const { settings, loading, updateSettings } = useTimetable();
  
  const [schoolYear, setSchoolYear] = useState('2025');
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(6);
  const [periodDuration, setPeriodDuration] = useState(50);
  const [breakAfterPeriod, setBreakAfterPeriod] = useState<number[]>([3]);
  const [breakDuration, setBreakDuration] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setSchoolYear(settings.school_year);
      setDaysPerWeek(settings.days_per_week);
      setPeriodsPerDay(settings.periods_per_day);
      setPeriodDuration(settings.period_duration_minutes);
      setBreakAfterPeriod(settings.break_after_period || [3]);
      setBreakDuration(settings.break_duration_minutes);
    }
  }, [settings]);

  const toggleBreakPeriod = (period: number) => {
    setBreakAfterPeriod(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period)
        : [...prev, period].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        school_year: schoolYear,
        days_per_week: daysPerWeek,
        periods_per_day: periodsPerDay,
        period_duration_minutes: periodDuration,
        break_after_period: breakAfterPeriod,
        break_duration_minutes: breakDuration
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TimetableLayout title="Configurações" description="Configure os parâmetros do horário escolar">
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </TimetableLayout>
    );
  }

  return (
    <TimetableLayout title="Configurações" description="Configure os parâmetros do horário escolar">
      <div className="space-y-6 max-w-2xl">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Básicas</CardTitle>
            <CardDescription>Defina a estrutura básica do horário escolar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schoolYear">Ano Letivo</Label>
                <Input
                  id="schoolYear"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysPerWeek">Dias por Semana</Label>
                <Input
                  id="daysPerWeek"
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodsPerDay">Aulas por Dia</Label>
                <Input
                  id="periodsPerDay"
                  type="number"
                  min={1}
                  max={10}
                  value={periodsPerDay}
                  onChange={(e) => setPeriodsPerDay(parseInt(e.target.value) || 6)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodDuration">Duração da Aula (min)</Label>
                <Input
                  id="periodDuration"
                  type="number"
                  min={30}
                  max={120}
                  value={periodDuration}
                  onChange={(e) => setPeriodDuration(parseInt(e.target.value) || 50)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Break Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Intervalos</CardTitle>
            <CardDescription>Configure quando ocorrem os intervalos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Intervalo após qual aula?</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: periodsPerDay - 1 }, (_, i) => i + 1).map(period => (
                  <div key={period} className="flex items-center space-x-2">
                    <Checkbox
                      id={`break-${period}`}
                      checked={breakAfterPeriod.includes(period)}
                      onCheckedChange={() => toggleBreakPeriod(period)}
                    />
                    <Label htmlFor={`break-${period}`} className="font-normal">
                      Após {period}ª aula
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="breakDuration">Duração do Intervalo (min)</Label>
              <Input
                id="breakDuration"
                type="number"
                min={5}
                max={60}
                value={breakDuration}
                onChange={(e) => setBreakDuration(parseInt(e.target.value) || 15)}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </TimetableLayout>
  );
};

const TimetableSettings = () => {
  return (
    <SchoolMappingProvider>
      <TimetableProvider>
        <SettingsContent />
      </TimetableProvider>
    </SchoolMappingProvider>
  );
};

export default TimetableSettings;
