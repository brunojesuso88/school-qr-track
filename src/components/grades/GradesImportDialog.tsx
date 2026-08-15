import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText, AlertTriangle, CheckCircle2, Info, GraduationCap } from 'lucide-react';
import { GradesReviewTable, ReviewRow } from './GradesReviewTable';
import { GradesConflictsPanel } from './GradesConflictsPanel';
import { GradesRegistrationAudit } from './GradesRegistrationAudit';
import { GradesClassMismatchPanel } from './GradesClassMismatchPanel';
import {
  DetectedStudent, FieldDecision, RegistrationDecision, Resolution, ResolutionAction,
  defaultRegistrationDecision, isResolved, needsResolution,
} from './gradesConflicts';

interface ImportIssue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

interface ImportStats {
  pages: number | null;
  students_detected: number;
  students_matched: number;
  students_unmatched: number;
  students_in_class: number;
  students_missing_in_pdf: number;
  subjects: number;
  periods: number;
  grades_read: number;
  cells_total: number;
  low_confidence: number;
  empty_cells: number;
  explicit_zero_cells?: number;
  absence_cells_ignored?: number;
  class_codes?: string[];
  invalid_values: number;
  reconciled_cells: number;
  issues: number;
  errors: number;
  warnings: number;
}

interface ParsedSubject {
  normalized_name: string;
  name: string;
  weekly_classes: number | null;
  matched_expected: string | null;
  sort_order: number;
}

interface ParsedPeriod {
  normalized_label: string;
  label: string;
  kind: string;
  sort_order: number;
}

interface GradesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: { id: string; name: string; shift: string; mapping_class_id?: string | null } | null;
  onImported?: () => void;
}

type Step = 'select' | 'processing' | 'class-conflict' | 'review' | 'saving' | 'done';

const normalize = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9º°ª\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseValue = (raw: string | null): { value: number | null; invalid: boolean } => {
  if (raw == null) return { value: null, invalid: false };
  const text = raw.trim();
  if (!text || ['-', '--', '—'].includes(text)) return { value: null, invalid: false };
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return { value: null, invalid: true };
  return { value: Number(cleaned), invalid: false };
};

const PERIOD_ORDER = ['1º período', '2º período', '3º período', '4º período', 'media final', 'rec final', 'cons class', 'pendencia', 'final'];
const periodRank = (label: string) => {
  const idx = PERIOD_ORDER.indexOf(normalize(label));
  return idx === -1 ? PERIOD_ORDER.length : idx;
};

/** Revisão ordenada por aluno > disciplina > período/etapa. */
const sortReviewRows = (rows: ReviewRow[]) =>
  [...rows].sort((a, b) => {
    const byStudent = (a.matched_name || a.student_name).localeCompare(b.matched_name || b.student_name, 'pt-BR');
    if (byStudent !== 0) return byStudent;
    const bySubject = a.subject.localeCompare(b.subject, 'pt-BR');
    if (bySubject !== 0) return bySubject;
    const byPeriod = periodRank(a.period) - periodRank(b.period);
    if (byPeriod !== 0) return byPeriod;
    return a.period.localeCompare(b.period, 'pt-BR');
  });

export const GradesImportDialog = ({ open, onOpenChange, classItem, onImported }: GradesImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [subjects, setSubjects] = useState<ParsedSubject[]>([]);
  const [periods, setPeriods] = useState<ParsedPeriod[]>([]);
  const [classStudents, setClassStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [detected, setDetected] = useState<DetectedStudent[]>([]);
  const [missingInPdf, setMissingInPdf] = useState<{ id: string; full_name: string; student_id?: string | null }[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [regDecisions, setRegDecisions] = useState<Record<string, RegistrationDecision>>({});
  const [reviewTab, setReviewTab] = useState('conflicts');
  const [expectedSubjects, setExpectedSubjects] = useState<{ id: string; name: string; weekly_classes: number }[]>([]);
  const [conflictKeys, setConflictKeys] = useState<Set<string>>(new Set());
  const [conflictStrategy, setConflictStrategy] = useState<'keep' | 'overwrite'>('keep');
  const [savedCount, setSavedCount] = useState(0);
  const [effectiveName, setEffectiveName] = useState<string>('');
  const [pdfClassNames, setPdfClassNames] = useState<string[]>([]);
  const [renamingClass, setRenamingClass] = useState(false);

  const reset = useCallback(() => {
    setStep('select');
    setFileName('');
    setError(null);
    setStats(null);
    setIssues([]);
    setRows([]);
    setSubjects([]);
    setPeriods([]);
    setDetected([]);
    setMissingInPdf([]);
    setResolutions({});
    setRegDecisions({});
    setReviewTab('conflicts');
    setConflictKeys(new Set());
    setConflictStrategy('keep');
    setSavedCount(0);
    setEffectiveName('');
    setPdfClassNames([]);
    setRenamingClass(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const loadConflicts = useCallback(async (
    classId: string,
    parsedRows: ReviewRow[],
    parsedSubjects: ParsedSubject[],
    parsedPeriods: ParsedPeriod[],
  ) => {
    const [subjRes, perRes] = await Promise.all([
      supabase.from('grade_subjects').select('id, normalized_name').eq('class_id', classId),
      supabase.from('grade_periods').select('id, normalized_label').eq('class_id', classId),
    ]);
    const subjById = new Map<string, string>();
    (subjRes.data || []).forEach((s: { id: string; normalized_name: string }) => subjById.set(s.id, s.normalized_name));
    const perById = new Map<string, string>();
    (perRes.data || []).forEach((p: { id: string; normalized_label: string }) => perById.set(p.id, p.normalized_label));
    if (subjById.size === 0 || perById.size === 0) {
      setConflictKeys(new Set());
      return;
    }
    const { data } = await supabase
      .from('student_grades')
      .select('student_id, grade_subject_id, grade_period_id')
      .in('grade_subject_id', [...subjById.keys()]);
    const keys = new Set<string>();
    (data || []).forEach((g: { student_id: string; grade_subject_id: string; grade_period_id: string }) => {
      const subjNorm = subjById.get(g.grade_subject_id);
      const perNorm = perById.get(g.grade_period_id);
      if (!subjNorm || !perNorm) return;
      const subject = parsedSubjects.find((s) => s.normalized_name === subjNorm);
      const period = parsedPeriods.find((p) => p.normalized_label === perNorm);
      if (!subject || !period) return;
      keys.add(`${g.student_id}||${subject.name}||${period.label}`);
    });
    setConflictKeys(keys);
    void parsedRows;
  }, []);

  const handleFile = async (file: File) => {
    if (!classItem) return;
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O PDF deve ter no máximo 10MB.');
      return;
    }
    setFileName(file.name);
    setError(null);
    setStep('processing');
    setEffectiveName(classItem.name);

    try {
      // Alunos da turma
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, full_name, student_id, school_code, birth_date, mother_name, father_name')
        .eq('class', classItem.name)
        .order('full_name');
      if (studentsError) throw studentsError;
      const students = (studentsData || []) as {
        id: string; full_name: string; student_id: string;
        school_code: string | null; birth_date: string | null;
        mother_name: string | null; father_name: string | null;
      }[];
      setClassStudents(students.map((s) => ({ id: s.id, full_name: s.full_name })));

      // Disciplinas esperadas (mapeamento escolar, quando vinculado)
      let expected: { id: string; name: string; weekly_classes: number }[] = [];
      if (classItem.mapping_class_id) {
        const { data: subjData } = await supabase
          .from('mapping_class_subjects')
          .select('id, subject_name, weekly_classes')
          .eq('class_id', classItem.mapping_class_id);
        expected = (subjData || []).map((s: { id: string; subject_name: string; weekly_classes: number }) => ({
          id: s.id, name: s.subject_name, weekly_classes: s.weekly_classes,
        }));
      }
      setExpectedSubjects(expected);

      const pdfBase64 = await fileToBase64(file);
      const { data, error: fnError } = await supabase.functions.invoke('parse-grades-pdf', {
        body: {
          pdfBase64,
          fileName: file.name,
          class_id: classItem.id,
          class_code: classItem.name,
          students: students.map((s) => ({
            id: s.id,
            full_name: s.full_name,
            student_id: s.student_id,
            school_code: s.school_code,
            birth_date: s.birth_date,
            mother_name: s.mother_name,
            father_name: s.father_name,
          })),
          expected_subjects: expected.map((s) => ({ name: s.name, weekly_classes: s.weekly_classes })),
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Não foi possível processar o boletim.');

      const parsedRows: ReviewRow[] = sortReviewRows(
        (data.rows || []).map((r: ReviewRow) => ({ ...r, flags: r.flags || [], source: 'import' as const })),
      );
      setRows(parsedRows);
      setSubjects(data.subjects || []);
      setPeriods(data.periods || []);
      setStats(data.stats || null);
      setIssues(data.issues || []);

      const detectedList: DetectedStudent[] = (data.detected_students || []).map((d: DetectedStudent) => ({
        ...d,
        conflicts: d.conflicts || [],
        pages: d.pages || [],
      }));
      setDetected(detectedList);
      setMissingInPdf(data.students_missing_in_pdf || []);
      const initialDecisions: Record<string, RegistrationDecision> = {};
      detectedList.forEach((d) => { initialDecisions[d.key] = defaultRegistrationDecision(d); });
      setRegDecisions(initialDecisions);
      setResolutions({});
      setReviewTab(detectedList.some((d) => needsResolution(d)) ? 'conflicts' : 'grades');
      await loadConflicts(classItem.id, parsedRows, data.subjects || [], data.periods || []);

      const codes: string[] = (data.stats?.class_codes || []).filter(Boolean).map((c: string) => String(c).trim());
      setPdfClassNames(codes);
      const divergent = codes.filter((c) => normalize(c) !== normalize(classItem.name));
      setStep(divergent.length > 0 ? 'class-conflict' : 'review');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao processar o PDF.');
      setStep('select');
    }
  };

  const pdfClassName = useMemo(() => {
    if (!classItem) return '';
    return pdfClassNames.find((c) => normalize(c) !== normalize(classItem.name)) ?? pdfClassNames[0] ?? '';
  }, [pdfClassNames, classItem]);

  const classEvidence = useMemo(() => {
    const matched = detected.filter((d) => d.student_id).length;
    const total = detected.length || 1;
    return { matched, strong: matched / total >= 0.6 && matched > 0 };
  }, [detected]);

  /** Renomeia a turma para o nome exato do PDF (com auditoria) — nunca automático. */
  const handleRenameClass = async () => {
    if (!classItem || !pdfClassName) return;
    setRenamingClass(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const oldName = effectiveName || classItem.name;

      const { error: classError } = await supabase
        .from('classes')
        .update({ name: pdfClassName })
        .eq('id', classItem.id);
      if (classError) throw classError;

      const { error: studentsError } = await supabase
        .from('students')
        .update({ class: pdfClassName })
        .eq('class', oldName);
      if (studentsError) throw studentsError;

      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE',
        table_name: 'classes',
        record_id: classItem.id,
        old_data: { name: oldName } as never,
        new_data: { name: pdfClassName, reason: 'Divergência de turma no boletim importado', file_name: fileName } as never,
      });

      setEffectiveName(pdfClassName);
      setStep('review');
      toast.success(`Turma renomeada para ${pdfClassName}.`);
      onImported?.();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o nome da turma.');
    } finally {
      setRenamingClass(false);
    }
  };

  const handleChangeStudent = (index: number, studentId: string | null) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const student = classStudents.find((s) => s.id === studentId);
      return {
        ...row,
        student_id: studentId,
        matched_name: student?.full_name ?? null,
        flags: [...new Set([...row.flags.filter((f) => f !== 'unmatched_student'), 'manual'])],
      };
    }));
  };

  const handleChangeValue = (index: number, raw: string) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const { value, invalid } = parseValue(raw || null);
      const flags = row.flags.filter((f) => !['invalid_value', 'low_confidence', 'empty_cell', 'out_of_scale', 'reconciliation_divergence'].includes(f));
      if (invalid) flags.push('invalid_value');
      if (!invalid && value == null) flags.push('empty_cell');
      if (value === 0) flags.push('explicit_zero');
      return {
        ...row,
        raw_value: raw || null,
        note_raw: raw || null,
        note_numeric: value,
        value,
        source: 'manual' as const,
        flags: [...new Set([...flags, 'manual'])],
      };
    }));
  };

  const blockingCount = useMemo(
    () => rows.filter((r) => {
      if (r.flags.includes('invalid_value')) return true;
      if (r.student_id) return false;
      const res = resolutions[normalize(r.student_name)];
      if (res?.action === 'ignore' || res?.action === 'create') return false;
      return r.value != null || Boolean(r.raw_value);
    }).length,
    [rows, resolutions],
  );

  const handleResolve = (key: string, action: ResolutionAction, studentId?: string | null) => {
    setResolutions((prev) => ({ ...prev, [key]: { action, student_id: action === 'link' || action === 'confirm' ? studentId ?? null : null } }));
    if (action === 'link' || action === 'confirm') {
      const student = classStudents.find((s) => s.id === studentId);
      setRows((prev) => prev.map((row) => (normalize(row.student_name) === key
        ? {
          ...row,
          student_id: studentId ?? null,
          matched_name: student?.full_name ?? row.matched_name,
          flags: [...new Set([...row.flags.filter((f) => f !== 'unmatched_student'), action === 'link' ? 'manual' : 'fuzzy_student_match'])],
        }
        : row)));
    } else {
      setRows((prev) => prev.map((row) => (normalize(row.student_name) === key
        ? { ...row, student_id: null, matched_name: null }
        : row)));
    }
    setDetected((prev) => prev.map((d) => (d.key === key
      ? { ...d, student_id: action === 'link' || action === 'confirm' ? studentId ?? null : null }
      : d)));
  };

  const handleRegistrationDecision = (key: string, field: keyof RegistrationDecision, decision: FieldDecision) => {
    setRegDecisions((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { code: 'keep', birth_date: 'keep', mother: 'keep', father: 'keep' }), [field]: decision },
    }));
  };

  const pendingConflicts = useMemo(
    () => detected.filter((d) => needsResolution(d) && !isResolved(d, resolutions[d.key])),
    [detected, resolutions],
  );

  const importableRows = useMemo(() => rows.filter((r) => r.student_id && !r.flags.includes('invalid_value')), [rows]);
  const hasConflicts = useMemo(
    () => importableRows.some((r) => conflictKeys.has(`${r.student_id}||${r.subject}||${r.period}`)),
    [importableRows, conflictKeys],
  );

  const handleConfirm = async () => {
    if (!classItem) return;
    setStep('saving');
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      // 0. Alunos novos criados a partir do boletim (ação "Cadastrar novo aluno")
      const shiftCode = classItem.shift === 'morning' ? 'M' : classItem.shift === 'afternoon' ? 'T' : 'N';
      const createdIdByKey = new Map<string, string>();
      const toCreate = detected.filter((d) => resolutions[d.key]?.action === 'create');
      for (const d of toCreate) {
        const initials = d.pdf_name.trim().split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join('');
        const { data: created, error: createError } = await supabase
          .from('students')
          .insert({
            full_name: d.pdf_name,
            student_id: `${initials}-${classItem.name}-${shiftCode}`,
            class: classItem.name,
            shift: classItem.shift as never,
            qr_code: `STU-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            school_code: d.pdf_code,
            birth_date: d.pdf_birth_date,
            mother_name: d.pdf_mother_name,
            father_name: d.pdf_father_name,
            created_by: userId,
          })
          .select('id')
          .single();
        if (createError) throw createError;
        createdIdByKey.set(d.key, created.id);
      }

      const rowsToSave = rows.map((row) => {
        const key = normalize(row.student_name);
        const createdId = createdIdByKey.get(key);
        return createdId ? { ...row, student_id: createdId } : row;
      });

      // 1. Períodos
      const periodPayload = periods.map((p) => ({
        class_id: classItem.id,
        label: p.label,
        normalized_label: p.normalized_label || normalize(p.label),
        // Colunas finais do boletim (Média Final, Rec. Final, Cons. Class, Pendência, Final)
        // são gravadas como 'final'; o tipo exato fica preservado no label.
        kind: p.kind === 'period'
          ? 'period'
          : ['final', 'media_final', 'rec_final', 'cons_class', 'pendencia'].includes(p.kind)
            ? 'final'
            : 'unknown',
        sort_order: p.sort_order,
      }));
      const { data: periodRows, error: periodError } = await supabase
        .from('grade_periods')
        .upsert(periodPayload, { onConflict: 'class_id,normalized_label' })
        .select('id, normalized_label');
      if (periodError) throw periodError;
      const periodIdByNorm = new Map<string, string>();
      (periodRows || []).forEach((p: { id: string; normalized_label: string }) => periodIdByNorm.set(p.normalized_label, p.id));

      // 2. Disciplinas (preserva include_in_ira já configurado)
      const { data: existingSubjects } = await supabase
        .from('grade_subjects')
        .select('id, normalized_name, include_in_ira, custom_ira_weight')
        .eq('class_id', classItem.id);
      const existingByNorm = new Map<string, { include_in_ira: boolean; custom_ira_weight: number | null }>();
      (existingSubjects || []).forEach((s: { normalized_name: string; include_in_ira: boolean; custom_ira_weight: number | null }) =>
        existingByNorm.set(s.normalized_name, { include_in_ira: s.include_in_ira, custom_ira_weight: s.custom_ira_weight }));

      const subjectPayload = subjects.map((s) => {
        const expected = s.matched_expected
          ? expectedSubjects.find((e) => e.name === s.matched_expected)
          : undefined;
        const previous = existingByNorm.get(s.normalized_name);
        const weekly = expected?.weekly_classes ?? s.weekly_classes ?? null;
        return {
          class_id: classItem.id,
          name: s.name,
          normalized_name: s.normalized_name || normalize(s.name),
          mapping_class_subject_id: expected?.id ?? null,
          weekly_classes: weekly,
          include_in_ira: previous?.include_in_ira ?? (weekly === 1 || weekly === 2 || weekly === 4),
          custom_ira_weight: previous?.custom_ira_weight ?? null,
          sort_order: s.sort_order,
        };
      });
      const { data: subjectRows, error: subjectError } = await supabase
        .from('grade_subjects')
        .upsert(subjectPayload, { onConflict: 'class_id,normalized_name' })
        .select('id, normalized_name');
      if (subjectError) throw subjectError;
      const subjectIdByNorm = new Map<string, string>();
      (subjectRows || []).forEach((s: { id: string; normalized_name: string }) => subjectIdByNorm.set(s.normalized_name, s.id));

      // 3. Registro da importação (histórico)
      const auditResolutions = detected
        .filter((d) => needsResolution(d))
        .map((d) => ({
          pdf_name: d.pdf_name,
          pdf_code: d.pdf_code,
          pages: d.pages,
          conflicts: d.conflicts,
          action: resolutions[d.key]?.action ?? null,
          linked_student_id: createdIdByKey.get(d.key) ?? resolutions[d.key]?.student_id ?? null,
        }));

      const { data: importRow, error: importError } = await supabase
        .from('grade_imports')
        .insert({
          class_id: classItem.id,
          file_name: fileName,
          status: 'confirmed',
          conflict_strategy: conflictStrategy,
          stats: { ...(stats ?? {}), student_resolutions: auditResolutions } as never,
          issues: issues as never,
          created_by: userId,
        })
        .select('id')
        .single();
      if (importError) throw importError;

      // 4. Notas
      const gradePayload = rowsToSave
        .filter((r) => r.student_id && !r.flags.includes('invalid_value'))
        .map((row) => {
          const subjectId = subjectIdByNorm.get(normalize(row.subject));
          const periodId = periodIdByNorm.get(normalize(row.period));
          if (!subjectId || !periodId || !row.student_id) return null;
          return {
            student_id: row.student_id,
            grade_subject_id: subjectId,
            grade_period_id: periodId,
            value: row.value,
            raw_text: row.raw_value,
            confidence: row.confidence,
            flags: row.flags,
            source: row.source === 'manual' ? 'manual' : 'import',
            import_id: importRow.id,
            conflictKey: `${row.student_id}||${row.subject}||${row.period}`,
          };
        })
        .filter(Boolean) as (Record<string, unknown> & { conflictKey: string })[];

      const filtered = conflictStrategy === 'keep'
        ? gradePayload.filter((g) => !conflictKeys.has(g.conflictKey))
        : gradePayload;
      const finalPayload = filtered.map(({ conflictKey, ...rest }) => rest);

      if (finalPayload.length > 0) {
        const { error: gradesError } = await supabase
          .from('student_grades')
          .upsert(finalPayload as never, { onConflict: 'student_id,grade_subject_id,grade_period_id' });
        if (gradesError) throw gradesError;
      }

      // 5. Atualização cadastral (somente na confirmação final, conforme decisões do usuário)
      let updatedRegistrations = 0;
      for (const d of detected) {
        const studentId = d.student_id;
        if (!studentId || createdIdByKey.has(d.key)) continue;
        const dec = regDecisions[d.key] ?? defaultRegistrationDecision(d);
        const update: { school_code?: string; birth_date?: string; mother_name?: string; father_name?: string } = {};
        if (d.pdf_code && dec.code === 'update') update.school_code = d.pdf_code;
        if (d.pdf_birth_date && dec.birth_date === 'update') update.birth_date = d.pdf_birth_date;
        if (d.pdf_mother_name && dec.mother === 'update') update.mother_name = d.pdf_mother_name;
        if (d.pdf_father_name && dec.father === 'update') update.father_name = d.pdf_father_name;
        if (Object.keys(update).length === 0) continue;
        const { error: updError } = await supabase.from('students').update(update).eq('id', studentId);
        if (updError) throw updError;
        updatedRegistrations++;
      }

      setSavedCount(finalPayload.length);
      setStep('done');
      toast.success(
        `${finalPayload.length} nota(s) importada(s) para ${classItem.name}.` +
        (updatedRegistrations ? ` ${updatedRegistrations} cadastro(s) atualizado(s).` : '') +
        (createdIdByKey.size ? ` ${createdIdByKey.size} aluno(s) cadastrado(s).` : ''),
      );
      onImported?.();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao gravar as notas.');
      setStep('review');
      toast.error('Não foi possível concluir a importação.');
    }
  };

  const counter = (label: string, value: number | string | null, tone?: 'danger' | 'warning') => (
    <div className="rounded-lg border p-2 text-center">
      <p className={`text-lg font-semibold ${tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-amber-600' : ''}`}>
        {value ?? '—'}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Inserir boletim da turma {classItem ? `— ${classItem.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Selecionar PDF → Processando → Auditoria → Revisão → Confirmar importação. Nada é gravado antes da confirmação.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Envie o PDF do boletim desta turma (até 10MB). Todas as páginas serão analisadas.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Selecionar PDF
              </Button>
            </div>
            {classItem && !classItem.mapping_class_id && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle className="text-sm">Turma sem vínculo com o mapeamento escolar</AlertTitle>
                <AlertDescription className="text-xs">
                  A carga semanal das disciplinas (usada no peso do IRA) não será preenchida automaticamente.
                  Vincule a turma em Configurações → Configuração do IRA.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {(step === 'processing' || step === 'saving') && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {step === 'processing'
                ? 'Lendo todas as páginas, validando a matriz de notas e reconciliando células suspeitas...'
                : 'Gravando disciplinas, períodos e notas...'}
            </p>
          </div>
        )}

        {step === 'review' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {counter('Páginas', stats.pages)}
              {counter('Alunos detectados', stats.students_detected)}
              {counter('Alunos vinculados', stats.students_matched)}
              {counter('Não identificados', stats.students_unmatched, stats.students_unmatched ? 'danger' : undefined)}
              {counter('Disciplinas', stats.subjects)}
              {counter('Períodos', stats.periods)}
              {counter('Notas lidas', stats.grades_read)}
              {counter('Baixa confiança', stats.low_confidence, stats.low_confidence ? 'warning' : undefined)}
              {counter('Sem nota (vazias)', stats.empty_cells)}
              {counter('Notas 0,00', stats.explicit_zero_cells ?? 0)}
              {counter('Inconsistências', stats.issues, stats.errors ? 'danger' : stats.warnings ? 'warning' : undefined)}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Turma do cabeçalho: {stats.class_codes?.length ? stats.class_codes.join(', ') : '—'} · células de faltas ignoradas: {stats.absence_cells_ignored ?? 0}
            </p>

            {issues.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {issues.map((issue, i) => (
                  <Alert key={i} variant={issue.level === 'error' ? 'destructive' : 'default'}>
                    {issue.level === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                    <AlertDescription className="text-xs">{issue.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {hasConflicts && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Já existem notas para algumas combinações aluno + disciplina + período
                </p>
                <RadioGroup value={conflictStrategy} onValueChange={(v) => setConflictStrategy(v as 'keep' | 'overwrite')}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="keep" id="conflict-keep" />
                    <Label htmlFor="conflict-keep" className="text-sm font-normal">Manter as notas existentes (recomendado)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="overwrite" id="conflict-overwrite" />
                    <Label htmlFor="conflict-overwrite" className="text-sm font-normal">Sobrescrever com as notas deste PDF</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Tabs value={reviewTab} onValueChange={setReviewTab}>
              <TabsList className="w-full">
                <TabsTrigger value="conflicts" className="flex-1 text-xs">
                  Conflitos do boletim{pendingConflicts.length > 0 ? ` (${pendingConflicts.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="grades" className="flex-1 text-xs">Notas ({rows.length})</TabsTrigger>
                <TabsTrigger value="registration" className="flex-1 text-xs">Atualização cadastral</TabsTrigger>
              </TabsList>

              <TabsContent value="conflicts" className="mt-3">
                <GradesConflictsPanel
                  detected={detected}
                  missingInPdf={missingInPdf}
                  classStudents={classStudents}
                  resolutions={resolutions}
                  onResolve={handleResolve}
                />
              </TabsContent>

              <TabsContent value="grades" className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Revisão ({rows.length} células)</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{importableRows.length} prontas para importar</Badge>
                    {blockingCount > 0 && <Badge variant="destructive">{blockingCount} exigem revisão</Badge>}
                  </div>
                </div>
                <GradesReviewTable
                  rows={rows}
                  students={classStudents}
                  onChangeStudent={handleChangeStudent}
                  onChangeValue={handleChangeValue}
                  conflictKeys={conflictKeys}
                />
              </TabsContent>

              <TabsContent value="registration" className="mt-3">
                <GradesRegistrationAudit
                  entries={detected}
                  decisions={regDecisions}
                  onDecide={handleRegistrationDecision}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 'done' && (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <p className="font-medium">Importação concluída</p>
            <p className="text-sm text-muted-foreground">
              {savedCount} nota(s) gravada(s). As notas já aparecem na aba “Notas” de cada aluno.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar (não grava nada)</Button>
              {pendingConflicts.length > 0 && (
                <p className="text-xs text-destructive mr-auto">
                  Resolva os {pendingConflicts.length} conflito(s) de alunos para liberar a confirmação.
                </p>
              )}
              <Button
                onClick={handleConfirm}
                disabled={importableRows.length === 0 || blockingCount > 0 || pendingConflicts.length > 0}
              >
                Confirmar importação
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={() => handleClose(false)}>Fechar</Button>}
          {step === 'select' && <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};