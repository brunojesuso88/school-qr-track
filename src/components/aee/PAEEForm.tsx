import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { differenceInYears, parse } from 'date-fns';
import { AISuggestPicker, appendBullets } from './AISuggestPicker';

export type PAEEArea = 'cognitiva' | 'motora' | 'comunicacao' | 'social' | 'comportamento';
export type PAEEFieldKey = 'objectives' | 'strategies' | 'evaluation_record';

export interface PAEEMatrixEntry {
  objectives: string;
  strategies: string;
  evaluation_record: string;
}

export interface PAEEData {
  school: string;
  age: number | '';
  elaboration_date: string;
  disability_type: string;
  composition: '' | 'individual' | 'dupla' | 'grupo';
  libras_interpreter: boolean;
  support_assistant: boolean;
  weekdays: string[];
  schedule_time: string;
  periodicity: '' | 'avaliacao_inicial' | '1_semestre' | '2_semestre';
  pedagogical_matrix: Record<PAEEArea, PAEEMatrixEntry>;
  aee_teacher_signature: string;
  coordinator_signature: string;
}

export const emptyPAEEMatrixEntry: PAEEMatrixEntry = {
  objectives: '',
  strategies: '',
  evaluation_record: '',
};

export const emptyPAEE: PAEEData = {
  school: '',
  age: '',
  elaboration_date: new Date().toISOString().split('T')[0],
  disability_type: '',
  composition: '',
  libras_interpreter: false,
  support_assistant: false,
  weekdays: [],
  schedule_time: '',
  periodicity: '',
  pedagogical_matrix: {
    cognitiva: { ...emptyPAEEMatrixEntry },
    motora: { ...emptyPAEEMatrixEntry },
    comunicacao: { ...emptyPAEEMatrixEntry },
    social: { ...emptyPAEEMatrixEntry },
    comportamento: { ...emptyPAEEMatrixEntry },
  },
  aee_teacher_signature: '',
  coordinator_signature: '',
};

export const DISABILITY_OPTIONS = [
  { value: 'intelectual', label: 'Intelectual' },
  { value: 'fisica', label: 'Física' },
  { value: 'auditiva', label: 'Auditiva' },
  { value: 'surdez', label: 'Surdez' },
  { value: 'visual', label: 'Visual' },
  { value: 'tea', label: 'TEA' },
  { value: 'altas_habilidades', label: 'Altas Habilidades / Superdotação' },
  { value: 'multipla', label: 'Múltipla' },
  { value: 'outros', label: 'Outros' },
];

export const WEEKDAYS = [
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Qui' },
  { value: 'sex', label: 'Sex' },
];

export const AREAS: Array<{ key: PAEEArea; label: string; tooltip: string }> = [
  {
    key: 'cognitiva',
    label: 'Cognitiva',
    tooltip: 'Atenção, memória, raciocínio, funções executivas, resolução de problemas e organização do pensamento.',
  },
  {
    key: 'motora',
    label: 'Motora',
    tooltip: 'Coordenação motora ampla e fina, lateralidade, equilíbrio, postura e habilidades manuais.',
  },
  {
    key: 'comunicacao',
    label: 'Comunicação',
    tooltip: 'Linguagem oral, escrita, comunicação alternativa/aumentativa (Libras, pictogramas) e compreensão.',
  },
  {
    key: 'social',
    label: 'Social',
    tooltip: 'Interação com pares e adultos, vínculos, cooperação, empatia e autonomia em contextos coletivos.',
  },
  {
    key: 'comportamento',
    label: 'Comportamento',
    tooltip: 'Autorregulação, tolerância à frustração, rotina, engajamento e resposta a limites.',
  },
];

export const FIELD_LABELS: Record<PAEEFieldKey, string> = {
  objectives: 'Objetivos',
  strategies: 'Estratégias',
  evaluation_record: 'Registro Avaliativo',
};

interface StudentInfo {
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  birth_date: string | null;
}

interface PAEEFormProps {
  student: StudentInfo;
  schoolName: string;
  data: PAEEData;
  onChange: (data: PAEEData) => void;
}

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

export const PAEEForm = ({ student, schoolName, data, onChange }: PAEEFormProps) => {
  const computedAge = student.birth_date
    ? differenceInYears(new Date(), parse(student.birth_date, 'yyyy-MM-dd', new Date()))
    : null;

  const update = <K extends keyof PAEEData>(key: K, value: PAEEData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const toggleWeekday = (value: string) => {
    const current = data.weekdays || [];
    update(
      'weekdays',
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };

  const updateMatrix = (area: PAEEArea, field: PAEEFieldKey, value: string) => {
    onChange({
      ...data,
      pedagogical_matrix: {
        ...data.pedagogical_matrix,
        [area]: { ...data.pedagogical_matrix[area], [field]: value },
      },
    });
  };

  const studentContext = {
    nome: student.full_name,
    turma: student.class,
    turno: shiftLabels[student.shift] || student.shift,
    idade: data.age || computedAge,
    deficiencia_cid: data.disability_type
      ? DISABILITY_OPTIONS.find((o) => o.value === data.disability_type)?.label
      : 'Não informado',
    composicao: data.composition,
    periodicidade: data.periodicity,
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        {/* 1. Identificação */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold border-b pb-2 text-slate-800 dark:text-slate-100">
            1. Identificação
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Nome do Estudante</Label>
              <Input value={student.full_name} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Escola</Label>
              <Input
                value={data.school || schoolName || ''}
                onChange={(e) => update('school', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Turma</Label>
              <Input value={student.class} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Idade</Label>
              <Input
                type="number"
                min={0}
                value={data.age === '' ? (computedAge ?? '') : data.age}
                onChange={(e) =>
                  update('age', e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder={computedAge !== null ? String(computedAge) : 'Idade'}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={data.elaboration_date}
                onChange={(e) => update('elaboration_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Deficiência / CID</Label>
              <Select
                value={data.disability_type || undefined}
                onValueChange={(v) => update('disability_type', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a deficiência/CID..." />
                </SelectTrigger>
                <SelectContent>
                  {DISABILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 2. Organização do Atendimento */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold border-b pb-2 text-slate-800 dark:text-slate-100">
            2. Organização do Atendimento
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Composição</Label>
              <Select
                value={data.composition || undefined}
                onValueChange={(v) => update('composition', v as PAEEData['composition'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="dupla">Dupla</SelectItem>
                  <SelectItem value="grupo">Grupo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periodicidade</Label>
              <Select
                value={data.periodicity || undefined}
                onValueChange={(v) => update('periodicity', v as PAEEData['periodicity'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avaliacao_inicial">Avaliação Inicial</SelectItem>
                  <SelectItem value="1_semestre">1º Semestre</SelectItem>
                  <SelectItem value="2_semestre">2º Semestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30 p-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Assistência na Sala Regular
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={data.libras_interpreter}
                  onCheckedChange={(v) => update('libras_interpreter', v === true)}
                />
                <span className="text-sm">Tradutor / Intérprete de Libras</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={data.support_assistant}
                  onCheckedChange={(v) => update('support_assistant', v === true)}
                />
                <span className="text-sm">Auxiliar de Apoio</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dias da Semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const active = data.weekdays?.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWeekday(d.value)}
                      className={
                        'h-10 min-w-[3.5rem] px-3 rounded-md border text-sm font-medium transition-colors ' +
                        (active
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-accent border-input')
                      }
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Horário</Label>
              <Input
                placeholder="Ex: 14h–15h"
                value={data.schedule_time}
                onChange={(e) => update('schedule_time', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 3. Matriz Pedagógica */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold border-b pb-2 text-slate-800 dark:text-slate-100">
            3. Matriz Pedagógica
          </h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Para cada área, descreva os objetivos pedagógicos, as estratégias adotadas e o registro
            avaliativo do progresso do estudante.
          </p>
          <div className="space-y-4">
            {AREAS.map((area) => (
              <div
                key={area.key}
                className="rounded-xl border bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-900/40 dark:to-blue-950/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Área {area.label}
                    </h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{area.tooltip}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {(['objectives', 'strategies', 'evaluation_record'] as PAEEFieldKey[]).map(
                  (field) => (
                    <div key={field} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {FIELD_LABELS[field]}
                        </Label>
                        <AISuggestPicker
                          functionName="paee-suggest"
                          body={{ context: studentContext, area: area.key, field }}
                          onAdd={(items) =>
                            updateMatrix(
                              area.key,
                              field,
                              appendBullets(data.pedagogical_matrix[area.key][field], items),
                            )
                          }
                        />
                      </div>
                      <Textarea
                        rows={3}
                        placeholder={
                          field === 'objectives'
                            ? 'Ex: Desenvolver atenção sustentada em atividades de 10–15 minutos.'
                            : field === 'strategies'
                              ? 'Ex: Uso de cronômetro visual, divisão de tarefas em etapas curtas e reforço positivo.'
                              : 'Ex: Estudante manteve atenção por 12 minutos consecutivos em 3 sessões.'
                        }
                        value={data.pedagogical_matrix[area.key][field]}
                        onChange={(e) => updateMatrix(area.key, field, e.target.value)}
                      />
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 4. Assinaturas */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold border-b pb-2 text-slate-800 dark:text-slate-100">
            4. Assinaturas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Professor(a) de AEE</Label>
              <Input
                value={data.aee_teacher_signature}
                onChange={(e) => update('aee_teacher_signature', e.target.value)}
                placeholder="Nome do(a) professor(a) responsável"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Coordenador(a)</Label>
              <Input
                value={data.coordinator_signature}
                onChange={(e) => update('coordinator_signature', e.target.value)}
                placeholder="Nome do(a) coordenador(a)"
              />
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};