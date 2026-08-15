import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Upload, FileText, AlertTriangle, CheckCircle2, Info, GraduationCap, SkipForward, Pencil, Zap,
} from 'lucide-react';
import { GradesReviewTable, ReviewRow } from './GradesReviewTable';
import { GradesRegistrationAudit } from './GradesRegistrationAudit';
import { GradesClassMismatchPanel } from './GradesClassMismatchPanel';
import { evaluateAutoAccept } from './gradesAutoAccept';
import {
  CONFLICT_LABELS, DetectedStudent, FieldDecision, RegistrationDecision,
  defaultRegistrationDecision, formatDate,
} from './gradesConflicts';

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

interface PagePreview {
  page: number;
  total_pages: number;
  pdf_class_code: string | null;
  student: {
    pdf_name: string;
    pdf_code: string | null;
    pdf_birth_date: string | null;
    pdf_mother_name: string | null;
    pdf_father_name: string | null;
  };
  detected: DetectedStudent;
  subjects: ParsedSubject[];
  periods: ParsedPeriod[];
  rows: ReviewRow[];
  stats: {
    cells_total: number;
    grades_read: number;
    empty_cells: number;
    explicit_zero_cells: number;
    invalid_values: number;
    low_confidence: number;
    subjects: number;
    periods: number;
  };
  notes: string[];
  reading?: {
    mode: 'fast' | 'validated';
    escalated: boolean;
    reasons: string[];
  };
}

interface SessionState {
  id: string;
  file_name: string | null;
  total_pages: number;
  current_page: number;
  confirmed_pages: number;
  ignored_pages: number;
  notes_imported: number;
  auto_accept?: boolean;
}

interface GradesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: { id: string; name: string; shift: string; mapping_class_id?: string | null } | null;
  onImported?: () => void;
}

type Step = 'select' | 'resume' | 'processing' | 'page' | 'saving' | 'summary' | 'failed';
type PageAction = 'link' | 'create' | 'ignore' | null;

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

export const GradesImportDialog = ({ open, onOpenChange, classItem, onImported }: GradesImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [resumable, setResumable] = useState<SessionState | null>(null);
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [classStudents, setClassStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [expectedSubjects, setExpectedSubjects] = useState<{ id: string; name: string; weekly_classes: number }[]>([]);
  const [pageAction, setPageAction] = useState<PageAction>(null);
  const [linkStudentId, setLinkStudentId] = useState<string | null>(null);
  const [regDecision, setRegDecision] = useState<RegistrationDecision | null>(null);
  const [conflictKeys, setConflictKeys] = useState<Set<string>>(new Set());
  const [conflictStrategy, setConflictStrategy] = useState<'keep' | 'overwrite'>('keep');
  const [effectiveName, setEffectiveName] = useState('');
  const [classDecision, setClassDecision] = useState<'pending' | 'resolved'>('resolved');
  const [renamingClass, setRenamingClass] = useState(false);
  const [savedTotal, setSavedTotal] = useState(0);
  const cancelledRef = useRef(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoApprovedPage, setAutoApprovedPage] = useState<number | null>(null);
  const autoRunRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setStep('select');
    setError(null);
    setSession(null);
    setResumable(null);
    setPreview(null);
    setRows([]);
    setEditing(false);
    setPageAction(null);
    setLinkStudentId(null);
    setRegDecision(null);
    setConflictKeys(new Set());
    setConflictStrategy('keep');
    setClassDecision('resolved');
    setRenamingClass(false);
    setSavedTotal(0);
    setAutoAccept(false);
    setAutoApprovedPage(null);
    autoRunRef.current = null;
    cancelledRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = (value: boolean) => {
    if (!value) {
      cancelledRef.current = true;
      reset();
    }
    onOpenChange(value);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** Alunos da turma + disciplinas esperadas (contexto persistido na sessão). */
  const loadContext = useCallback(async () => {
    if (!classItem) throw new Error('Turma não selecionada.');
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
    return { students, expected };
  }, [classItem]);

  /**
   * Notas já existentes para o aluno desta página (aluno + disciplina + período).
   * Só é conflito quando o valor existente DIVERGE do valor lido do PDF.
   * Valores iguais (7,5 == 7,50; 0 == 0,00; null == vazio) são "match existente".
   */
  const loadPageConflicts = useCallback(async (studentId: string | null, p: PagePreview) => {
    if (!classItem || !studentId) { setConflictKeys(new Set()); setIdenticalKeys(new Set()); return; }
    const [subjRes, perRes] = await Promise.all([
      supabase.from('grade_subjects').select('id, normalized_name').eq('class_id', classItem.id),
      supabase.from('grade_periods').select('id, normalized_label').eq('class_id', classItem.id),
    ]);
    const subjById = new Map<string, string>();
    (subjRes.data || []).forEach((s: { id: string; normalized_name: string }) => subjById.set(s.id, s.normalized_name));
    const perById = new Map<string, string>();
    (perRes.data || []).forEach((x: { id: string; normalized_label: string }) => perById.set(x.id, x.normalized_label));
    if (subjById.size === 0 || perById.size === 0) { setConflictKeys(new Set()); setIdenticalKeys(new Set()); return; }
    const { data } = await supabase
      .from('student_grades')
      .select('student_id, grade_subject_id, grade_period_id, value')
      .eq('student_id', studentId);

    // Valores lidos do PDF por chave (aluno + disciplina + período)
    const pdfByKey = new Map<string, number | null>();
    (p.rows || []).forEach((r) => {
      if ((r.flags || []).includes('invalid_value')) return;
      pdfByKey.set(`${studentId}||${r.subject}||${r.period}`, r.value ?? null);
    });

    const divergent = new Set<string>();
    const identical = new Set<string>();
    (data || []).forEach((g: { student_id: string; grade_subject_id: string; grade_period_id: string; value: number | null }) => {
      const subjNorm = subjById.get(g.grade_subject_id);
      const perNorm = perById.get(g.grade_period_id);
      if (!subjNorm || !perNorm) return;
      const subject = p.subjects.find((s) => s.normalized_name === subjNorm);
      const period = p.periods.find((x) => x.normalized_label === perNorm);
      if (!subject || !period) return;
      const key = `${g.student_id}||${subject.name}||${period.label}`;
      if (!pdfByKey.has(key)) return; // a página não trouxe essa combinação
      if (sameGradeValue(g.value ?? null, pdfByKey.get(key) ?? null)) identical.add(key);
      else divergent.add(key);
    });
    setConflictKeys(divergent);
    setIdenticalKeys(identical);
  }, [classItem]);

  const applyPreview = useCallback(async (p: PagePreview) => {
    setPreview(p);
    setRows((p.rows || []).map((r) => ({ ...r, flags: r.flags || [], source: 'import' as const })));
    setEditing(false);
    setConflictStrategy('keep');
    const detected = p.detected;
    setPageAction(detected.student_id ? 'link' : null);
    setLinkStudentId(detected.student_id ?? null);
    setRegDecision(defaultRegistrationDecision(detected));
    await loadPageConflicts(detected.student_id, p);
    const pdfClass = (p.pdf_class_code ?? '').trim();
    const divergent = Boolean(pdfClass) && normalize(pdfClass) !== normalize(effectiveName || classItem?.name || '');
    setClassDecision(divergent ? 'pending' : 'resolved');
    setStep('page');
  }, [loadPageConflicts, effectiveName, classItem]);

  /** Processa UMA página e abre a confirmação. */
  const processPage = useCallback(async (sessionId: string, pageNumber: number) => {
    setError(null);
    setStep('processing');
    setPreview(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-grade-page', {
        body: { action: 'page', session_id: sessionId, page_number: pageNumber },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao ler a página.');
      if (cancelledRef.current) return;
      setSession((prev) => (prev ? { ...prev, current_page: pageNumber } : prev));
      await applyPreview(data.preview as PagePreview);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao ler a página.');
      setStep('failed');
    }
  }, [applyPreview]);

  /** Sessão em aberto para esta turma (retomada). */
  useEffect(() => {
    if (!open || !classItem) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('grade_import_sessions')
        .select('id, file_name, total_pages, current_page, confirmed_pages, ignored_pages, notes_imported, status, auto_accept')
        .eq('class_id', classItem.id)
        .in('status', ['processing_page', 'awaiting_confirmation'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setResumable({
        id: data.id,
        file_name: data.file_name,
        total_pages: data.total_pages,
        current_page: data.current_page,
        confirmed_pages: data.confirmed_pages,
        ignored_pages: data.ignored_pages,
        notes_imported: data.notes_imported,
        auto_accept: Boolean(data.auto_accept),
      });
      setAutoAccept(Boolean(data.auto_accept));
      setStep('resume');
    })();
    return () => { cancelled = true; };
  }, [open, classItem]);

  useEffect(() => {
    if (open && classItem) setEffectiveName(classItem.name);
  }, [open, classItem]);

  const startImport = async (file: File) => {
    if (!classItem) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('O PDF deve ter no máximo 15MB.'); return; }
    cancelledRef.current = false;
    setError(null);
    setSavedTotal(0);
    setStep('processing');
    try {
      const { students, expected } = await loadContext();
      const pdfBase64 = await fileToBase64(file);
      const { data, error: fnError } = await supabase.functions.invoke('parse-grade-page', {
        body: {
          action: 'create',
          pdfBase64,
          fileName: file.name,
          class_id: classItem.id,
          class_code: classItem.name,
          students: students.map((s) => ({
            id: s.id, full_name: s.full_name, student_id: s.student_id,
            school_code: s.school_code, birth_date: s.birth_date,
            mother_name: s.mother_name, father_name: s.father_name,
          })),
          expected_subjects: expected.map((s) => ({ name: s.name, weekly_classes: s.weekly_classes })),
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Não foi possível iniciar a importação.');
      const newSession: SessionState = {
        id: data.session_id,
        file_name: file.name,
        total_pages: data.total_pages,
        current_page: 1,
        confirmed_pages: 0,
        ignored_pages: 0,
        notes_imported: 0,
        auto_accept: autoAccept,
      };
      setSession(newSession);
      if (autoAccept) {
        await supabase.from('grade_import_sessions').update({ auto_accept: true }).eq('id', newSession.id);
      }
      await processPage(newSession.id, 1);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao iniciar a importação.');
      setStep('failed');
    }
  };

  /** Retoma na primeira página ainda não confirmada/ignorada. */
  const resumeSession = async (target: SessionState) => {
    cancelledRef.current = false;
    setStep('processing');
    try {
      await loadContext();
      const { data: pages } = await supabase
        .from('grade_import_session_pages')
        .select('page_number, status')
        .eq('session_id', target.id)
        .order('page_number');
      const next = (pages || []).find((p: { status: string }) => !['confirmed', 'ignored'].includes(p.status));
      setSession(target);
      setResumable(null);
      if (!next) { setStep('summary'); return; }
      await processPage(target.id, next.page_number);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao retomar a sessão.');
      setStep('failed');
    }
  };

  const discardSession = async (target: SessionState) => {
    await supabase.functions.invoke('parse-grade-page', { body: { action: 'cancel', session_id: target.id } });
    setResumable(null);
    setStep('select');
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
      const flags = row.flags.filter((f) => !['invalid_value', 'low_confidence', 'empty_cell', 'out_of_scale'].includes(f));
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

  const targetStudentId = useMemo(() => {
    if (pageAction === 'link') return linkStudentId;
    return null;
  }, [pageAction, linkStudentId]);

  const invalidCount = useMemo(() => rows.filter((r) => r.flags.includes('invalid_value')).length, [rows]);
  const pageHasConflicts = useMemo(
    () => rows.some((r) => targetStudentId && conflictKeys.has(`${targetStudentId}||${r.subject}||${r.period}`)),
    [rows, conflictKeys, targetStudentId],
  );

  const canConfirmPage =
    classDecision === 'resolved' &&
    invalidCount === 0 &&
    (pageAction === 'create' || (pageAction === 'link' && Boolean(linkStudentId)));

  /** Avaliação estrita da autoaceitação da página atual (não grava nada). */
  const autoEval = useMemo(() => {
    if (!preview) return { eligible: false, reasons: [] as string[] };
    return evaluateAutoAccept({
      detected: preview.detected,
      rows,
      classDecisionPending: classDecision === 'pending',
      pageHasExistingGrades: pageHasConflicts,
      linkedStudentId: pageAction === 'link' ? linkStudentId : null,
      suggestedStudentId: preview.detected.student_id,
      regDecision,
    });
  }, [preview, rows, classDecision, pageHasConflicts, pageAction, linkStudentId, regDecision]);

  /** Persiste a preferência na sessão para valer também ao retomar. */
  const handleToggleAutoAccept = async (value: boolean) => {
    setAutoAccept(value);
    if (session) {
      await supabase.from('grade_import_sessions').update({ auto_accept: value }).eq('id', session.id);
      setSession((prev) => (prev ? { ...prev, auto_accept: value } : prev));
    }
  };

  /** Renomeia a turma para o nome do PDF (com auditoria) — nunca automático. */
  const handleRenameClass = async () => {
    if (!classItem || !preview?.pdf_class_code) return;
    setRenamingClass(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const oldName = effectiveName || classItem.name;
      const newName = preview.pdf_class_code.trim();
      const { error: classError } = await supabase.from('classes').update({ name: newName }).eq('id', classItem.id);
      if (classError) throw classError;
      const { error: studentsError } = await supabase.from('students').update({ class: newName }).eq('class', oldName);
      if (studentsError) throw studentsError;
      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id ?? null,
        action: 'UPDATE',
        table_name: 'classes',
        record_id: classItem.id,
        old_data: { name: oldName } as never,
        new_data: { name: newName, reason: 'Divergência de turma no boletim importado (página a página)', page: preview.page } as never,
      });
      setEffectiveName(newName);
      setClassDecision('resolved');
      toast.success(`Turma renomeada para ${newName}.`);
      onImported?.();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o nome da turma.');
    } finally {
      setRenamingClass(false);
    }
  };

  const advance = useCallback(async (updated: SessionState) => {
    if (updated.current_page >= updated.total_pages) {
      await supabase.from('grade_import_sessions')
        .update({ status: 'completed', pdf_base64: null })
        .eq('id', updated.id);
      setStep('summary');
      onImported?.();
      return;
    }
    await processPage(updated.id, updated.current_page + 1);
  }, [processPage, onImported]);

  /** Salva SOMENTE a página atual e segue para a próxima. */
  const handleConfirmPage = async (mode: 'manual' | 'auto' = 'manual') => {
    if (!classItem || !preview || !session) return;
    setStep('saving');
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const detected = preview.detected;
      let studentId = targetStudentId;

      // Cadastro de aluno novo a partir do boletim
      if (pageAction === 'create') {
        const shiftCode = classItem.shift === 'morning' ? 'M' : classItem.shift === 'afternoon' ? 'T' : 'N';
        const initials = detected.pdf_name.trim().split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join('');
        const { data: created, error: createError } = await supabase
          .from('students')
          .insert({
            full_name: detected.pdf_name,
            student_id: `${initials}-${effectiveName || classItem.name}-${shiftCode}`,
            class: effectiveName || classItem.name,
            shift: classItem.shift as never,
            qr_code: `STU-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            school_code: detected.pdf_code,
            birth_date: detected.pdf_birth_date,
            mother_name: detected.pdf_mother_name,
            father_name: detected.pdf_father_name,
            created_by: userId,
          })
          .select('id')
          .single();
        if (createError) throw createError;
        studentId = created.id;
      }
      if (!studentId) throw new Error('Selecione o aluno correspondente antes de salvar a página.');

      // Períodos e disciplinas desta página
      const periodPayload = preview.periods.map((p) => ({
        class_id: classItem.id,
        label: p.label,
        normalized_label: p.normalized_label || normalize(p.label),
        kind: p.kind === 'period'
          ? 'period'
          : ['final', 'media_final', 'rec_final', 'cons_class', 'pendencia'].includes(p.kind) ? 'final' : 'unknown',
        sort_order: p.sort_order,
      }));
      const periodIdByNorm = new Map<string, string>();
      if (periodPayload.length > 0) {
        const { data: periodRows, error: periodError } = await supabase
          .from('grade_periods')
          .upsert(periodPayload, { onConflict: 'class_id,normalized_label' })
          .select('id, normalized_label');
        if (periodError) throw periodError;
        (periodRows || []).forEach((p: { id: string; normalized_label: string }) => periodIdByNorm.set(p.normalized_label, p.id));
      }

      const { data: existingSubjects } = await supabase
        .from('grade_subjects')
        .select('id, normalized_name, include_in_ira, custom_ira_weight')
        .eq('class_id', classItem.id);
      const existingByNorm = new Map<string, { include_in_ira: boolean; custom_ira_weight: number | null }>();
      (existingSubjects || []).forEach((s: { normalized_name: string; include_in_ira: boolean; custom_ira_weight: number | null }) =>
        existingByNorm.set(s.normalized_name, { include_in_ira: s.include_in_ira, custom_ira_weight: s.custom_ira_weight }));

      const subjectPayload = preview.subjects.map((s) => {
        const expected = s.matched_expected ? expectedSubjects.find((e) => e.name === s.matched_expected) : undefined;
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
      const subjectIdByNorm = new Map<string, string>();
      if (subjectPayload.length > 0) {
        const { data: subjectRows, error: subjectError } = await supabase
          .from('grade_subjects')
          .upsert(subjectPayload, { onConflict: 'class_id,normalized_name' })
          .select('id, normalized_name');
        if (subjectError) throw subjectError;
        (subjectRows || []).forEach((s: { id: string; normalized_name: string }) => subjectIdByNorm.set(s.normalized_name, s.id));
      }

      // Notas da página (vazio = null; 0,00 = zero real; faltas nunca chegam aqui)
      const payload = rows
        .filter((r) => !r.flags.includes('invalid_value'))
        .map((row) => {
          const subjectId = subjectIdByNorm.get(normalize(row.subject));
          const periodId = periodIdByNorm.get(normalize(row.period));
          if (!subjectId || !periodId) return null;
          return {
            student_id: studentId as string,
            grade_subject_id: subjectId,
            grade_period_id: periodId,
            value: row.value,
            raw_text: row.raw_value,
            confidence: row.confidence,
            flags: row.flags,
            source: row.source === 'manual' ? 'manual' : 'import',
            conflictKey: `${studentId}||${row.subject}||${row.period}`,
          };
        })
        .filter(Boolean) as (Record<string, unknown> & { conflictKey: string })[];

      const filtered = conflictStrategy === 'keep'
        ? payload.filter((g) => !conflictKeys.has(g.conflictKey))
        : payload;
      const finalPayload = filtered.map(({ conflictKey, ...rest }) => rest);

      if (finalPayload.length > 0) {
        const { error: gradesError } = await supabase
          .from('student_grades')
          .upsert(finalPayload as never, { onConflict: 'student_id,grade_subject_id,grade_period_id' });
        if (gradesError) throw gradesError;
      }

      // Atualização cadastral conforme decisões explícitas (só quando o aluno já existia)
      if (pageAction === 'link' && regDecision) {
        const update: { school_code?: string; birth_date?: string; mother_name?: string; father_name?: string } = {};
        if (detected.pdf_code && regDecision.code === 'update') update.school_code = detected.pdf_code;
        if (detected.pdf_birth_date && regDecision.birth_date === 'update') update.birth_date = detected.pdf_birth_date;
        if (detected.pdf_mother_name && regDecision.mother === 'update') update.mother_name = detected.pdf_mother_name;
        if (detected.pdf_father_name && regDecision.father === 'update') update.father_name = detected.pdf_father_name;
        if (Object.keys(update).length > 0) {
          const { error: updError } = await supabase.from('students').update(update).eq('id', studentId);
          if (updError) throw updError;
        }
      }

      await supabase.from('grade_import_session_pages')
        .update({
          status: 'confirmed',
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
          confirmation_mode: mode === 'auto' ? 'auto' : 'manual',
        })
        .eq('session_id', session.id).eq('page_number', preview.page);

      const updated: SessionState = {
        ...session,
        current_page: preview.page,
        confirmed_pages: session.confirmed_pages + 1,
        notes_imported: session.notes_imported + finalPayload.length,
      };
      await supabase.from('grade_import_sessions').update({
        confirmed_pages: updated.confirmed_pages,
        notes_imported: updated.notes_imported,
      }).eq('id', session.id);
      setSession(updated);
      setSavedTotal((prev) => prev + finalPayload.length);
      toast.success(
        mode === 'auto'
          ? `Página ${preview.page} aprovada automaticamente: ${finalPayload.length} nota(s) gravada(s).`
          : `Página ${preview.page}: ${finalPayload.length} nota(s) gravada(s).`,
      );
      await advance(updated);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao gravar a página.');
      setStep('page');
      toast.error('Não foi possível salvar esta página.');
    }
  };

  const handleIgnorePage = async () => {
    if (!session || !preview) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('grade_import_session_pages')
      .update({ status: 'ignored', confirmed_by: userData?.user?.id ?? null, confirmed_at: new Date().toISOString() })
      .eq('session_id', session.id).eq('page_number', preview.page);
    const updated: SessionState = {
      ...session,
      current_page: preview.page,
      ignored_pages: session.ignored_pages + 1,
    };
    await supabase.from('grade_import_sessions').update({ ignored_pages: updated.ignored_pages }).eq('id', session.id);
    setSession(updated);
    toast.info(`Página ${preview.page} ignorada — nada foi gravado.`);
    await advance(updated);
  };

  const handleCancelSession = async () => {
    autoRunRef.current = 'stopped';
    if (session) {
      await supabase.functions.invoke('parse-grade-page', { body: { action: 'cancel', session_id: session.id } });
      toast.info('Importação encerrada. As páginas já confirmadas foram mantidas.');
    }
    onImported?.();
    handleClose(false);
  };

  const handleRetryPage = async () => {
    if (!session) { setStep('select'); return; }
    await processPage(session.id, session.current_page || 1);
  };

  /** Autoaceitação: grava e avança sozinho apenas quando a página é 100% elegível. */
  useEffect(() => {
    if (!autoAccept || step !== 'page' || !preview || !session) return;
    const key = `${session.id}:${preview.page}`;
    if (autoRunRef.current === key) return;
    if (!autoEval.eligible || !canConfirmPage) return;
    autoRunRef.current = key;
    setAutoApprovedPage(preview.page);
    void handleConfirmPage('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept, step, preview, session, autoEval.eligible, canConfirmPage]);

  const progress = session && session.total_pages > 0
    ? Math.round(((preview?.page ?? session.current_page) / session.total_pages) * 100)
    : 0;

  const counter = (label: string, value: number | string | null, tone?: 'danger' | 'warning') => (
    <div className="rounded-lg border p-2 text-center">
      <p className={`text-lg font-semibold ${tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-amber-600' : ''}`}>
        {value ?? '—'}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );

  const sessionSummary = session && (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {counter('Página atual', session.total_pages ? `${preview?.page ?? session.current_page}/${session.total_pages}` : null)}
      {counter('Confirmadas', session.confirmed_pages)}
      {counter('Ignoradas', session.ignored_pages)}
      {counter('Notas importadas', session.notes_imported)}
      {counter('Faltas', 'ignoradas')}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Inserir boletim da turma {classItem ? `— ${effectiveName || classItem.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Importação página a página: cada página é lida isoladamente e só é gravada após a sua confirmação.
            A coluna Faltas é sempre ignorada.
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
                Envie o PDF do boletim desta turma (até 15MB). As páginas serão lidas uma a uma, com confirmação sua a cada página.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) startImport(file);
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

        {step === 'resume' && resumable && (
          <div className="space-y-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle className="text-sm">Existe uma importação em andamento para esta turma</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>Arquivo: {resumable.file_name || '—'}</p>
                <p>
                  Página {resumable.current_page} de {resumable.total_pages} ·
                  {' '}{resumable.confirmed_pages} confirmada(s) · {resumable.ignored_pages} ignorada(s) ·
                  {' '}{resumable.notes_imported} nota(s) já gravada(s).
                </p>
                <p>Retomar continua na primeira página ainda não confirmada. Nada já salvo é perdido.</p>
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => resumeSession(resumable)}>Retomar de onde parei</Button>
              <Button variant="outline" onClick={() => discardSession(resumable)}>Encerrar e enviar outro PDF</Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-10 space-y-4">
            <div className="text-center space-y-2">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="font-medium">
                {session ? `Lendo a página ${session.current_page} de ${session.total_pages}...` : 'Preparando o boletim...'}
              </p>
              <p className="text-xs text-muted-foreground">
                Apenas esta página é enviada para leitura. Nada é gravado nesta etapa.
              </p>
            </div>
            <Progress value={progress} />
            {sessionSummary}
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={handleCancelSession}>Cancelar importação</Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            {autoAccept && autoApprovedPage != null && (
              <p className="text-sm font-medium text-green-600">
                ✓ Página {autoApprovedPage} aprovada automaticamente
              </p>
            )}
            <p className="text-sm text-muted-foreground">Gravando as notas desta página...</p>
          </div>
        )}

        {step === 'failed' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle className="text-sm">Esta página não pôde ser lida</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>Causa: {error ?? 'erro desconhecido'}</p>
                <p>Nenhuma nota foi gravada nesta página. As páginas já confirmadas permanecem salvas.</p>
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRetryPage}>Tentar ler novamente</Button>
              {session && preview && (
                <Button variant="outline" onClick={handleIgnorePage}>Ignorar esta página</Button>
              )}
              {session && !preview && session.current_page < session.total_pages && (
                <Button variant="outline" onClick={() => processPage(session.id, session.current_page + 1)}>
                  Pular para a próxima página
                </Button>
              )}
              <Button variant="ghost" onClick={handleCancelSession}>Encerrar importação</Button>
            </div>
          </div>
        )}

        {step === 'page' && preview && classItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                Página {preview.page} de {preview.total_pages}
              </Badge>
              {preview.reading && (
                <Badge
                  variant={preview.reading.escalated ? 'secondary' : 'outline'}
                  className="text-[10px]"
                >
                  {preview.reading.escalated ? 'Validação adicional aplicada' : 'Lida em modo rápido'}
                </Badge>
              )}
              <Progress value={progress} className="flex-1 min-w-[160px]" />
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch id="auto-accept" checked={autoAccept} onCheckedChange={handleToggleAutoAccept} />
                  <Label htmlFor="auto-accept" className="text-sm font-medium flex items-center gap-1">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Aceitar automaticamente páginas sem erros
                  </Label>
                </div>
                <Badge variant={autoAccept ? 'default' : 'outline'} className="text-[10px]">
                  Modo automático: {autoAccept ? 'ATIVADO' : 'DESATIVADO'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Páginas sem qualquer erro ou conflito serão gravadas automaticamente. Páginas com qualquer divergência
                continuarão exigindo sua confirmação. Células vazias não são erro e faltas seguem ignoradas.
              </p>
              {autoAccept && (
                autoEval.eligible && canConfirmPage ? (
                  <Badge className="text-[10px] bg-green-600 hover:bg-green-600">⚡ Aprovada automaticamente</Badge>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">
                      Revisão obrigatória — {autoEval.reasons.length || 1} pendência(s)
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      <ul className="list-disc pl-4">
                        {(autoEval.reasons.length ? autoEval.reasons : ['Confirmação manual necessária']).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )
              )}
            </div>
            {sessionSummary}

            {classDecision === 'pending' && preview.pdf_class_code && (
              <GradesClassMismatchPanel
                systemName={effectiveName || classItem.name}
                pdfName={preview.pdf_class_code}
                allPdfNames={[preview.pdf_class_code]}
                strongEvidence={Boolean(preview.detected.student_id)}
                pdfStudents={1}
                matchedStudents={preview.detected.student_id ? 1 : 0}
                classStudents={classStudents.length}
                sampleIdentifiers={[{
                  pdf_name: preview.detected.pdf_name,
                  pdf_code: preview.detected.pdf_code,
                  matched_name: preview.detected.matched_name,
                }]}
                renaming={renamingClass}
                onRename={handleRenameClass}
                onKeep={() => setClassDecision('resolved')}
                onCancel={handleCancelSession}
              />
            )}

            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium">Aluno detectado nesta página</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-xs">
                <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{preview.student.pdf_name || '—'}</span></p>
                <p><span className="text-muted-foreground">Código:</span> {preview.student.pdf_code || '—'}</p>
                <p><span className="text-muted-foreground">Data de nascimento:</span> {formatDate(preview.student.pdf_birth_date)}</p>
                <p><span className="text-muted-foreground">Turma no PDF:</span> {preview.pdf_class_code || '—'}</p>
                <p><span className="text-muted-foreground">Mãe:</span> {preview.student.pdf_mother_name || '—'}</p>
                <p><span className="text-muted-foreground">Pai:</span> {preview.student.pdf_father_name || '—'}</p>
              </div>
              {preview.detected.conflicts.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {preview.detected.conflicts.map((c) => (
                    <Badge key={c} variant={c === 'not_in_class' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {CONFLICT_LABELS[c] ?? c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {counter('Notas lidas', preview.stats.grades_read)}
              {counter('Células vazias', preview.stats.empty_cells)}
              {counter('Notas 0,00', preview.stats.explicit_zero_cells)}
              {counter('Baixa confiança', preview.stats.low_confidence, preview.stats.low_confidence ? 'warning' : undefined)}
              {counter('Valores inválidos', preview.stats.invalid_values, preview.stats.invalid_values ? 'danger' : undefined)}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Aluno correspondente no sistema</p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={pageAction === 'link' ? linkStudentId ?? undefined : undefined}
                  onValueChange={(v) => { setPageAction('link'); setLinkStudentId(v); }}
                >
                  <SelectTrigger className="h-8 w-[260px] text-xs">
                    <SelectValue placeholder="Vincular a aluno existente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant={pageAction === 'create' ? 'default' : 'outline'}
                  onClick={() => { setPageAction('create'); setLinkStudentId(null); }}>
                  Cadastrar novo aluno
                </Button>
                {preview.detected.status !== 'unmatched' && (
                  <span className="text-[11px] text-muted-foreground">
                    Sugestão do sistema: {preview.detected.matched_name} ({(preview.detected.match_score * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
              {pageAction === 'create' && (
                <p className="text-[11px] text-muted-foreground">
                  O aluno será cadastrado nesta turma com nome, Código, nascimento, Mãe e Pai lidos do boletim.
                </p>
              )}
              {!pageAction && (
                <p className="text-[11px] text-destructive">
                  Escolha vincular a um aluno existente, cadastrar novo aluno ou ignorar esta página.
                </p>
              )}
            </div>

            {pageHasConflicts && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Já existem notas gravadas para este aluno em algumas disciplinas/períodos desta página
                </p>
                <RadioGroup value={conflictStrategy} onValueChange={(v) => setConflictStrategy(v as 'keep' | 'overwrite')}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="keep" id="page-conflict-keep" />
                    <Label htmlFor="page-conflict-keep" className="text-sm font-normal">Manter as notas existentes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="overwrite" id="page-conflict-overwrite" />
                    <Label htmlFor="page-conflict-overwrite" className="text-sm font-normal">Substituir pelas notas do PDF</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {pageAction === 'link' && linkStudentId === preview.detected.student_id && regDecision && (
              <GradesRegistrationAudit
                entries={[preview.detected]}
                decisions={{ [preview.detected.key]: regDecision }}
                onDecide={(_key, field, decision) =>
                  setRegDecision((prev) => ({ ...(prev ?? defaultRegistrationDecision(preview.detected)), [field]: decision }))}
              />
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">Notas desta página ({rows.length} células)</p>
                <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => setEditing((v) => !v)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  {editing ? 'Concluir correções' : 'Corrigir antes de salvar'}
                </Button>
              </div>
              {editing ? (
                <GradesReviewTable
                  rows={rows}
                  students={classStudents}
                  onChangeStudent={handleChangeStudent}
                  onChangeValue={handleChangeValue}
                  conflictKeys={conflictKeys}
                />
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 px-3">Disciplina</th>
                        {preview.periods.map((p) => (
                          <th key={p.normalized_label} className="py-2 px-2 whitespace-nowrap">{p.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.subjects.map((s) => (
                        <tr key={s.normalized_name} className="border-b last:border-0">
                          <td className="py-1.5 px-3 font-medium whitespace-nowrap">{s.name}</td>
                          {preview.periods.map((p) => {
                            const row = rows.find((r) => normalize(r.subject) === s.normalized_name && normalize(r.period) === p.normalized_label);
                            return (
                              <td key={p.normalized_label} className="py-1.5 px-2 whitespace-nowrap">
                                {row?.raw_value ?? <span className="text-muted-foreground">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                “—” = célula vazia no boletim (será salva como sem nota) · “0,00” = nota zero real ·
                a coluna Faltas do boletim é totalmente ignorada.
              </p>
            </div>

            {preview.notes.length > 0 && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  {preview.notes.join(' · ')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 'summary' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <p className="font-medium">Importação concluída</p>
            <p className="text-sm text-muted-foreground">
              {session?.confirmed_pages ?? 0} página(s) confirmada(s) · {session?.ignored_pages ?? 0} ignorada(s) ·
              {' '}{savedTotal} nota(s) gravada(s) nesta sessão.
            </p>
            <p className="text-xs text-muted-foreground">
              Nenhuma gravação adicional foi feita. As notas já aparecem na aba “Notas” de cada aluno.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'page' && (
            <>
              <Button variant="ghost" onClick={handleCancelSession}>Cancelar importação</Button>
              <Button variant="outline" onClick={handleIgnorePage}>
                <SkipForward className="w-4 h-4 mr-1" />
                Ignorar página
              </Button>
              <Button onClick={() => handleConfirmPage('manual')} disabled={!canConfirmPage}>
                Confirmar e próxima página
              </Button>
            </>
          )}
          {step === 'summary' && <Button onClick={() => handleClose(false)}>Fechar</Button>}
          {step === 'select' && <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
