import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { differenceInYears, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useState } from 'react';
import {
  FUNCTIONAL_PROFILE_SUGGESTIONS,
  POTENTIALITIES_SUGGESTIONS,
  LEARNING_BARRIERS_SUGGESTIONS,
  INTERVENTION_PLAN_SUGGESTIONS,
  ADAPTATION_PORTUGUES_HUMANAS_SUGGESTIONS,
  ADAPTATION_MATEMATICA_EXATAS_SUGGESTIONS,
  ADAPTATION_CIENCIAS_HUMANAS_SUGGESTIONS,
  EVALUATION_CRITERIA_SUGGESTIONS,
} from './peiSuggestions';

export type PerformanceLevel = 'independente' | 'com_apoio' | 'nao_realiza' | '';

export interface InterventionRow {
  objetivo: string;
  estrategia: string;
  frequencia: string;
  responsavel: string;
  recurso: string;
}

export interface PEIData {
  enrollment_number: string;
  aee_teacher: string;
  coordination: string;
  elaboration_date: string;
  legal_guardian: string;
  contact: string;
  email: string;
  phone: string;
  functional_profile: string;
  potentialities: string;
  learning_barriers: string;
  evaluation_criteria: string;
  performance_levels: {
    linguagem: PerformanceLevel;
    matematica: PerformanceLevel;
    ciencias_natureza: PerformanceLevel;
    ciencias_humanas: PerformanceLevel;
  };
  intervention_plan: InterventionRow[];
  discipline_adaptations: {
    portugues_humanas: string;
    matematica_exatas: string;
    ciencias_humanas: string;
  };
}

export const emptyPEI: PEIData = {
  enrollment_number: '',
  aee_teacher: '',
  coordination: '',
  elaboration_date: new Date().toISOString().split('T')[0],
  legal_guardian: '',
  contact: '',
  email: '',
  phone: '',
  functional_profile: '',
  potentialities: '',
  learning_barriers: '',
  evaluation_criteria: '',
  performance_levels: {
    linguagem: '',
    matematica: '',
    ciencias_natureza: '',
    ciencias_humanas: '',
  },
  intervention_plan: [],
  discipline_adaptations: {
    portugues_humanas: '',
    matematica_exatas: '',
    ciencias_humanas: '',
  },
};

interface SuggestionPickerProps {
  options: string[];
  onPick: (text: string) => void;
  label?: string;
}

const SuggestionPicker = ({ options, onPick, label = 'Sugestões' }: SuggestionPickerProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,90vw)] p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar sugestão..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma sugestão.</CommandEmpty>
            <CommandGroup>
              {options.map((opt, i) => (
                <CommandItem
                  key={i}
                  value={opt}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                  }}
                  className="text-sm items-start"
                >
                  <span className="leading-snug">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const appendText = (current: string, addition: string): string => {
  if (!current.trim()) return addition;
  return `${current.trimEnd()}\n${addition}`;
};

interface StudentInfo {
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  birth_date: string | null;
}

interface PEIFormProps {
  student: StudentInfo;
  data: PEIData;
  onChange: (data: PEIData) => void;
}

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

const PERFORMANCE_AREAS: Array<{ key: keyof PEIData['performance_levels']; label: string }> = [
  { key: 'linguagem', label: 'Linguagem' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'ciencias_natureza', label: 'Ciências da Natureza' },
  { key: 'ciencias_humanas', label: 'Ciências Humanas' },
];

export const PEIForm = ({ student, data, onChange }: PEIFormProps) => {
  const age = student.birth_date
    ? differenceInYears(new Date(), parse(student.birth_date, 'yyyy-MM-dd', new Date()))
    : null;

  const update = <K extends keyof PEIData>(key: K, value: PEIData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const updatePerformance = (area: keyof PEIData['performance_levels'], value: PerformanceLevel) => {
    onChange({ ...data, performance_levels: { ...data.performance_levels, [area]: value } });
  };

  const updateAdaptation = (area: keyof PEIData['discipline_adaptations'], value: string) => {
    onChange({ ...data, discipline_adaptations: { ...data.discipline_adaptations, [area]: value } });
  };

  const addInterventionRow = () => {
    onChange({
      ...data,
      intervention_plan: [
        ...data.intervention_plan,
        { objetivo: '', estrategia: '', frequencia: '', responsavel: '', recurso: '' },
      ],
    });
  };

  const removeInterventionRow = (idx: number) => {
    onChange({
      ...data,
      intervention_plan: data.intervention_plan.filter((_, i) => i !== idx),
    });
  };

  const updateInterventionRow = (idx: number, field: keyof InterventionRow, value: string) => {
    const next = [...data.intervention_plan];
    next[idx] = { ...next[idx], [field]: value };
    onChange({ ...data, intervention_plan: next });
  };

  const addInterventionFromSuggestion = (s: typeof INTERVENTION_PLAN_SUGGESTIONS[number]) => {
    onChange({
      ...data,
      intervention_plan: [
        ...data.intervention_plan,
        {
          objetivo: s.objetivo,
          estrategia: s.estrategia,
          frequencia: s.frequencia || '',
          responsavel: s.responsavel || '',
          recurso: s.recurso || '',
        },
      ],
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Identificação */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold border-b pb-2">1. Identificação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Nome Completo</Label>
            <Input value={student.full_name} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data de nascimento</Label>
            <Input value={student.birth_date || 'Não informada'} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Idade</Label>
            <Input value={age !== null ? `${age} anos` : 'Não informada'} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Turma</Label>
            <Input value={student.class} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Turno</Label>
            <Input value={shiftLabels[student.shift] || student.shift} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nº matrícula</Label>
            <Input
              value={data.enrollment_number || student.student_id}
              onChange={(e) => update('enrollment_number', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data de elaboração</Label>
            <Input
              type="date"
              value={data.elaboration_date}
              onChange={(e) => update('elaboration_date', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Professor(a) AEE</Label>
            <Input
              value={data.aee_teacher}
              onChange={(e) => update('aee_teacher', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Coordenação</Label>
            <Input
              value={data.coordination}
              onChange={(e) => update('coordination', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Responsável legal</Label>
            <Input
              value={data.legal_guardian}
              onChange={(e) => update('legal_guardian', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contato</Label>
            <Input
              value={data.contact}
              onChange={(e) => update('contact', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input
              value={data.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 2. Perfil Funcional */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">2. Perfil Funcional de Aprendizagem</h3>
          <SuggestionPicker
            options={FUNCTIONAL_PROFILE_SUGGESTIONS}
            onPick={(t) => update('functional_profile', appendText(data.functional_profile, t))}
          />
        </div>
        <Textarea
          placeholder="Descreva como o estudante aprende, formas de comunicação, atenção, autonomia e estilo cognitivo."
          value={data.functional_profile}
          onChange={(e) => update('functional_profile', e.target.value)}
          rows={4}
        />
      </section>

      {/* 3. Potencialidades */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">3. Potencialidades</h3>
          <SuggestionPicker
            options={POTENTIALITIES_SUGGESTIONS}
            onPick={(t) => update('potentialities', appendText(data.potentialities, t))}
          />
        </div>
        <Textarea
          placeholder="Descreva habilidades, interesses e pontos fortes relevantes."
          value={data.potentialities}
          onChange={(e) => update('potentialities', e.target.value)}
          rows={4}
        />
      </section>

      {/* 4. Barreiras */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">4. Barreiras de Aprendizagem</h3>
          <SuggestionPicker
            options={LEARNING_BARRIERS_SUGGESTIONS}
            onPick={(t) => update('learning_barriers', appendText(data.learning_barriers, t))}
          />
        </div>
        <Textarea
          placeholder="Descreva dificuldades acadêmicas, comportamentais, sensoriais e de organização."
          value={data.learning_barriers}
          onChange={(e) => update('learning_barriers', e.target.value)}
          rows={4}
        />
      </section>

      {/* 5. Nível Atual de Desempenho */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold border-b pb-2">5. Nível Atual de Desempenho</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Área</th>
                <th className="text-left p-2 font-medium">Nível</th>
              </tr>
            </thead>
            <tbody>
              {PERFORMANCE_AREAS.map((area) => (
                <tr key={area.key} className="border-t">
                  <td className="p-2">{area.label}</td>
                  <td className="p-2">
                    <Select
                      value={data.performance_levels[area.key] || undefined}
                      onValueChange={(v) => updatePerformance(area.key, v as PerformanceLevel)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="independente">Nível Independente</SelectItem>
                        <SelectItem value="com_apoio">Com apoio</SelectItem>
                        <SelectItem value="nao_realiza">Não realiza</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Plano de Intervenção */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold border-b pb-2">7. Plano de Intervenção Pedagógica</h3>
        {data.intervention_plan.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma linha adicionada.</p>
        )}
        <div className="space-y-3">
          {data.intervention_plan.map((row, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeInterventionRow(idx)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Objetivo</Label>
                  <Textarea
                    rows={2}
                    value={row.objetivo}
                    onChange={(e) => updateInterventionRow(idx, 'objetivo', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estratégia</Label>
                  <Textarea
                    rows={2}
                    value={row.estrategia}
                    onChange={(e) => updateInterventionRow(idx, 'estrategia', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Frequência</Label>
                  <Input
                    value={row.frequencia}
                    onChange={(e) => updateInterventionRow(idx, 'frequencia', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Input
                    value={row.responsavel}
                    onChange={(e) => updateInterventionRow(idx, 'responsavel', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Recurso</Label>
                  <Input
                    value={row.recurso}
                    onChange={(e) => updateInterventionRow(idx, 'recurso', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addInterventionRow}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar linha
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Adicionar a partir de sugestão
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar objetivo/estratégia..." />
                <CommandList className="max-h-80">
                  <CommandEmpty>Nenhuma sugestão.</CommandEmpty>
                  <CommandGroup>
                    {INTERVENTION_PLAN_SUGGESTIONS.map((s, i) => (
                      <CommandItem
                        key={i}
                        value={`${s.objetivo} ${s.estrategia}`}
                        onSelect={() => addInterventionFromSuggestion(s)}
                        className="flex flex-col items-start gap-1 py-2"
                      >
                        <span className="text-sm font-medium">{s.objetivo}</span>
                        <span className="text-xs text-muted-foreground">{s.estrategia}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* 8. Adaptações por Disciplina */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold border-b pb-2">8. Adaptações por Disciplina</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Língua Portuguesa e Humanas</Label>
              <SuggestionPicker
                options={ADAPTATION_PORTUGUES_HUMANAS_SUGGESTIONS}
                onPick={(t) =>
                  updateAdaptation('portugues_humanas', appendText(data.discipline_adaptations.portugues_humanas, t))
                }
              />
            </div>
            <Textarea
              rows={3}
              value={data.discipline_adaptations.portugues_humanas}
              onChange={(e) => updateAdaptation('portugues_humanas', e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Matemática e Exatas</Label>
              <SuggestionPicker
                options={ADAPTATION_MATEMATICA_EXATAS_SUGGESTIONS}
                onPick={(t) =>
                  updateAdaptation('matematica_exatas', appendText(data.discipline_adaptations.matematica_exatas, t))
                }
              />
            </div>
            <Textarea
              rows={3}
              value={data.discipline_adaptations.matematica_exatas}
              onChange={(e) => updateAdaptation('matematica_exatas', e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Ciências Humanas</Label>
              <SuggestionPicker
                options={ADAPTATION_CIENCIAS_HUMANAS_SUGGESTIONS}
                onPick={(t) =>
                  updateAdaptation('ciencias_humanas', appendText(data.discipline_adaptations.ciencias_humanas, t))
                }
              />
            </div>
            <Textarea
              rows={3}
              value={data.discipline_adaptations.ciencias_humanas}
              onChange={(e) => updateAdaptation('ciencias_humanas', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 9. Avaliação e Critérios */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">9. Avaliação e Critérios</h3>
          <SuggestionPicker
            options={EVALUATION_CRITERIA_SUGGESTIONS}
            onPick={(t) => update('evaluation_criteria', appendText(data.evaluation_criteria, t))}
          />
        </div>
        <Textarea
          placeholder="Defina instrumentos, critérios de sucesso e tipo de adaptação."
          value={data.evaluation_criteria}
          onChange={(e) => update('evaluation_criteria', e.target.value)}
          rows={4}
        />
      </section>
    </div>
  );
};