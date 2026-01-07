import { useState } from 'react';
import { TimetableProvider, useTimetable } from '@/contexts/TimetableContext';
import { SchoolMappingProvider } from '@/contexts/SchoolMappingContext';
import TimetableLayout from '@/components/timetable/TimetableLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Scale, AlertTriangle, RefreshCw, Layers, Clock } from 'lucide-react';

const RULE_ICONS: Record<string, typeof Scale> = {
  'avoid_same_subject_same_day': RefreshCw,
  'avoid_teacher_gaps': Clock,
  'prefer_paired_lessons': Layers,
  'distribute_heavy_subjects': Scale,
  'respect_teacher_availability': AlertTriangle
};

const RulesContent = () => {
  const { rules, loading, toggleRule, updateRulePriority } = useTimetable();
  const [localPriorities, setLocalPriorities] = useState<Record<string, number>>({});

  const handleToggle = async (ruleId: string, active: boolean) => {
    try {
      await toggleRule(ruleId, active);
      toast.success(active ? 'Regra ativada' : 'Regra desativada');
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handlePriorityChange = (ruleId: string, priority: number) => {
    setLocalPriorities(prev => ({ ...prev, [ruleId]: priority }));
  };

  const handlePriorityCommit = async (ruleId: string, priority: number) => {
    try {
      await updateRulePriority(ruleId, priority);
      toast.success('Prioridade atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar prioridade');
    }
  };

  if (loading) {
    return (
      <TimetableLayout title="Regras Pedagógicas" description="Configure as regras para geração automática">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </TimetableLayout>
    );
  }

  return (
    <TimetableLayout title="Regras Pedagógicas" description="Configure as regras para geração automática">
      <div className="space-y-4 max-w-3xl">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              As regras abaixo são consideradas durante a geração automática do horário. 
              Ative ou desative conforme a necessidade da sua escola e ajuste a prioridade 
              (quanto maior, mais importante).
            </p>
          </CardContent>
        </Card>

        {rules.map(rule => {
          const Icon = RULE_ICONS[rule.rule_type] || Scale;
          
          return (
            <Card key={rule.id} className={rule.is_active ? '' : 'opacity-60'}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {rule.rule_name}
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          Prioridade: {rule.priority}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {rule.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                  />
                </div>
              </CardHeader>
              
              {rule.is_active && (
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">
                      Prioridade:
                    </Label>
                    <div className="flex-1 flex items-center gap-4">
                      <Slider
                        value={[localPriorities[rule.id] ?? rule.priority]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(value) => handlePriorityChange(rule.id, value[0])}
                        onValueCommit={(value) => handlePriorityCommit(rule.id, value[0])}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-6 text-right">
                        {localPriorities[rule.id] ?? rule.priority}
                      </span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </TimetableLayout>
  );
};

const TimetableRules = () => {
  return (
    <SchoolMappingProvider>
      <TimetableProvider>
        <RulesContent />
      </TimetableProvider>
    </SchoolMappingProvider>
  );
};

export default TimetableRules;
