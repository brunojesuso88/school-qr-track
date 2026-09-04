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
import { GradesDivergencePanel } from './GradesDivergencePanel';
import { ClassCurriculumGate } from './ClassCurriculumGate';
import {
  analyzeDivergences, AutoAcceptRules, DEFAULT_AUTO_ACCEPT_RULES, evaluateAutoAccept, parseAutoAcceptRules,
} from './gradesAutoAccept';
import { useAuth } from '@/contexts/AuthContext';
import {
  digitsOnly, findGlobalMatch, nameTokens, pickClassName, sanitizeSchoolCodeForStorage,
} from '@/lib/gradePageLocal/studentMatch';
import {
  closePdfDocument, extractPageTokens, LocalPdfDocument, openPdfDocument,
} from '@/lib/gradePageLocal/pdfText';
import { parseGradePageLocal } from '@/lib/gradePageLocal/parseGradePageLocal';
import { reconcileLocalWithAi } from '@/lib/gradePageLocal/reconcile';
import {
  manualConfirmationBlockers, rowsForManualLocalConfirmation, shouldValidateWithAi,
} from './gradesManualConfirm';
import { LocalContextStudent, LocalExpectedSubject } from '@/lib/gradePageLocal/types';
import { CatalogSubject, buildEffectiveSubjectMatrix } from '@/lib/gradePageLocal/effectiveMatrix';
import { fetchCurriculumMatrix, matrixToExpectedSubjects } from '@/lib/curriculumMatrix';
import { markIraStale } from '@/lib/iraSnapshot/recompute';
import { resolveClassMatrix } from '@/lib/classCurriculum/sync';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import { assertActiveSchool } from '@/lib/schools/scope';
import { parseSeriesValue } from '@/lib/series';
import { canonicalSubjectKey, classifyPeriodLabel, isPeriodKind, periodRank } from '@/lib/gradePageLocal/normalize';
import { resolveClassNameFromPdf, samePdfClassBaseName } from '@/lib/classNames/salaFora';
import {
  matchesSecondPass,
  sameGradeValue,
  stripReconciliationFlags,
} from '@/lib/gradePageLocal/gradeCompare';
import {
  CONFLICT_LABELS, DetectedStudent, FieldDecision, RegistrationDecision,
  defaultRegistrationDecision, formatDate,
} from './gradesConflicts';

interface ParsedSubject {
  normalized_name: string;
  name: string;
  /** Ocorrência da disciplina na etapa (1 = primeira; Matriz Integral pode repetir). */
  slot_index?: number | null;
  weekly_classes: number | null;
  matched_expected: string | null;
  sort_order: number;
}

/** Identidade de uma nota na conferência: aluno + disciplina + ocorrência + período. */
const gradeConflictKey = (
  studentId: string,
  subject: string,
  slotIndex: number | null | undefined,
  period: string,
) => `${studentId}||${subject}#${slotIndex ?? 1}||${period}`;

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
    mode: 'fast' | 'validated' | 'local' | 'local_validated' | 'ai_fallback';
    escalated: boolean;
    reasons: string[];
    local_score?: number;
    divergences?: number;
    absence_tokens_dropped?: number;
    duration_ms?: number;
    /** Autoridade da leitura local nesta página. */
    authority?: 'authoritative' | 'needs_validation';
    /** IA foi efetivamente chamada. */
    ai_used?: boolean;
    /** Códigos bloqueantes/informativos da leitura local. */
    blockers?: string[];
    advisories?: string[];
    /** Células vazias vistas só pela IA e descartadas na reconciliação. */
    ai_empty_ignored?: number;
    /** Notas sugeridas apenas pela IA e descartadas por autoridade local. */
    ai_only_numeric_ignored?: number;
    /** Marca de resolução humana da validação nesta página. */
    resolved_by?: string;
    /** Disciplinas materializadas pela matriz da turma (sem notas lançadas). */
    anchored_subjects?: string[];
    /** Linhas de disciplina com nome quebrado em duas linhas e fundidas. */
    merged_subject_lines?: number;
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
  auto_accept_rules?: AutoAcceptRules;
}

interface GradesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: { id: string; name: string; shift: string; mapping_class_id?: string | null } | null;
  onImported?: () => void;
}

type Step = 'select' | 'resume' | 'processing' | 'page' | 'saving' | 'summary' | 'failed' | 'context_error';
type PageAction = 'link' | 'create' | 'ignore' | null;

interface OtherClassMatch {
  id: string;
  full_name: string;
  class: string;
  school_code: string | null;
  by: 'code' | 'name';
}
/** Modo de leitura (feature flag). Padrão: local com validação da IA quando necessário. */
type ReadingMode = 'local_ai' | 'always_ai' | 'ai_only';

const READING_MODE_LABELS: Record<ReadingMode, string> = {
  local_ai: 'Leitura local + validação por IA',
  always_ai: 'Sempre validar com IA',
  ai_only: 'Somente IA (modo anterior)',
};

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

/** Comparação semântica de notas: 7,5 == 7,50; 0 == 0,00; null == vazio. */
export { sameGradeValue };

/** Classificação canônica de uma coluna do boletim (rótulo tem prioridade sobre o kind recebido). */
const columnIsPeriod = (label: string, kind?: string | null) => {
  const byLabel = classifyPeriodLabel(label);
  if (byLabel) return byLabel.kind === 'period';
  return isPeriodKind(kind);
};

/**
 * Mantém apenas 1º→4º Período. Média Final, Rec. Final, Cons. Class, Pendência e Final
 * são descartadas da prévia (não são exibidas, não são gravadas e não entram no IRA).
 */
const keepOnlyPeriodColumns = (p: PagePreview): PagePreview => {
  const periods = (p.periods || [])
    .filter((period) => columnIsPeriod(period.label, period.kind))
    .sort((a, b) => periodRank(a.label) - periodRank(b.label) || a.sort_order - b.sort_order)
    .map((period, index) => ({ ...period, kind: 'period', sort_order: index }));
  const allowed = new Set(periods.map((period) => normalize(period.label)));
  const rows = (p.rows || []).filter((r) => allowed.has(normalize(r.period)));
  return {
    ...p,
    periods,
    rows,
    stats: {
      ...p.stats,
      cells_total: rows.length,
      grades_read: rows.filter((r) => r.value != null).length,
      empty_cells: rows.filter((r) => r.value == null && !(r.flags || []).includes('invalid_value')).length,
      explicit_zero_cells: rows.filter((r) => r.value === 0).length,
      invalid_values: rows.filter((r) => (r.flags || []).includes('invalid_value')).length,
      periods: periods.length,
    },
  };
};

export const GradesImportDialog = ({ open, onOpenChange, classItem, onImported }: GradesImportDialogProps) => {
  const activeSchoolId = useActiveSchoolId();
  /** Turma só libera upload após série definida + matriz oficial sincronizada. */
  const [curriculumReady, setCurriculumReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userRole } = useAuth();
  const canEditRegistration = userRole === 'admin' || userRole === 'direction';
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
  const [identicalKeys, setIdenticalKeys] = useState<Set<string>>(new Set());
  const [conflictStrategy, setConflictStrategy] = useState<'keep' | 'overwrite'>('keep');
  const [effectiveName, setEffectiveName] = useState('');
  const effectiveNameRef = useRef('');
  const [contextBlock, setContextBlock] = useState<{ className: string; found: number } | null>(null);
  const [otherClassMatch, setOtherClassMatch] = useState<OtherClassMatch | null>(null);
  const [movingStudent, setMovingStudent] = useState(false);
  const [classDecision, setClassDecision] = useState<'pending' | 'resolved'>('resolved');
  const [renamingClass, setRenamingClass] = useState(false);
  const [savedTotal, setSavedTotal] = useState(0);
  const cancelledRef = useRef(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoRules, setAutoRules] = useState<AutoAcceptRules>(DEFAULT_AUTO_ACCEPT_RULES);
  const [applyingLocalReading, setApplyingLocalReading] = useState(false);
  const [autoApprovedPage, setAutoApprovedPage] = useState<number | null>(null);
  const autoRunRef = useRef<string | null>(null);
  /** Página já resolvida automaticamente pela exceção de aluno não identificado. */
  const autoStudentRef = useRef<string | null>(null);
  const [readingMode, setReadingMode] = useState<ReadingMode>('local_ai');
  const pdfDocRef = useRef<LocalPdfDocument | null>(null);
  const localStudentsRef = useRef<LocalContextStudent[]>([]);
  const localExpectedRef = useRef<LocalExpectedSubject[]>([]);
  const [localTimings, setLocalTimings] = useState<number[]>([]);
  const [localSolvedPages, setLocalSolvedPages] = useState(0);

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
    setIdenticalKeys(new Set());
    setConflictStrategy('keep');
    setClassDecision('resolved');
    setRenamingClass(false);
    setContextBlock(null);
    setOtherClassMatch(null);
    setMovingStudent(false);
    setSavedTotal(0);
    setAutoAccept(false);
    setAutoRules(DEFAULT_AUTO_ACCEPT_RULES);
    setAutoApprovedPage(null);
    autoRunRef.current = null;
    autoStudentRef.current = null;
    cancelledRef.current = false;
    closePdfDocument(pdfDocRef.current);
    pdfDocRef.current = null;
    localStudentsRef.current = [];
    localExpectedRef.current = [];
    setLocalTimings([]);
    setLocalSolvedPages(0);
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

  /**
   * Nome ATUAL da turma lido de `classes` pelo id — nunca confiar na prop `classItem.name`,
   * que fica desatualizada quando a turma é renomeada durante a importação.
   */
  const resolveCurrentClassName = useCallback(async () => {
    if (!classItem) return '';
    const { data, error } = await supabase
      .from('classes')
      .select('name')
      .eq('school_id', assertActiveSchool(activeSchoolId))
      .eq('id', classItem.id)
      .maybeSingle();
    if (error) console.error('Não foi possível resolver o nome atual da turma:', error);
    return pickClassName(error ? null : data?.name, effectiveNameRef.current, classItem.name);
  }, [classItem, activeSchoolId]);

  /** Alunos da turma + disciplinas esperadas (contexto persistido na sessão). */
  const loadContext = useCallback(async () => {
    if (!classItem) throw new Error('Turma não selecionada.');
    const className = await resolveCurrentClassName();
    if (className && className !== effectiveNameRef.current) {
      effectiveNameRef.current = className;
      setEffectiveName(className);
    }
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, student_id, school_code, birth_date, mother_name, father_name')
      .eq('school_id', assertActiveSchool(activeSchoolId))
      .eq('class', className)
      .order('full_name');
    if (studentsError) throw studentsError;
    const students = (studentsData || []) as {
      id: string; full_name: string; student_id: string;
      school_code: string | null; birth_date: string | null;
      mother_name: string | null; father_name: string | null;
    }[];

    // Guarda: contexto vazio com alunos existentes no banco = falha de carregamento/desincronia.
    if (students.length === 0) {
      const [current, byProp] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', assertActiveSchool(activeSchoolId)).eq('class', className),
        className !== classItem.name
          ? supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', assertActiveSchool(activeSchoolId)).eq('class', classItem.name)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ]);
      const found = (current.count ?? 0) + (byProp.count ?? 0);
      if (found > 0) {
        setContextBlock({ className, found });
        setStep('context_error');
        throw new Error('CONTEXT_EMPTY');
      }
    }
    setContextBlock(null);
    setClassStudents(students.map((s) => ({ id: s.id, full_name: s.full_name })));

    let expected: { id: string; name: string; weekly_classes: number }[] = [];
    if (classItem.mapping_class_id) {
      const { data: subjData } = await supabase
        .from('mapping_class_subjects')
        .select('id, subject_name, weekly_classes')
        .eq('school_id', assertActiveSchool(activeSchoolId))
        .eq('class_id', classItem.mapping_class_id);
      expected = (subjData || []).map((s: { id: string; subject_name: string; weekly_classes: number }) => ({
        id: s.id, name: s.subject_name, weekly_classes: s.weekly_classes,
      }));
    }
    setExpectedSubjects(expected);
    localStudentsRef.current = students.map((s) => ({
      id: s.id, full_name: s.full_name, student_id: s.student_id,
      school_code: s.school_code, birth_date: s.birth_date,
      mother_name: s.mother_name, father_name: s.father_name,
    }));
    // Matriz efetiva de âncoras: mapeamento da turma + disciplinas já importadas + catálogo da série.
    const [{ data: gradeSubj }, { data: classRow }] = await Promise.all([
      supabase.from('grade_subjects').select('name, weekly_classes').eq('school_id', assertActiveSchool(activeSchoolId)).eq('class_id', classItem.id).eq('legacy_excluded', false),
      supabase.from('classes').select('series').eq('school_id', assertActiveSchool(activeSchoolId)).eq('id', classItem.id).maybeSingle(),
    ]);
    const series = (classRow as { series?: string | null } | null)?.series ?? null;
    const { data: catalog } = await supabase
      .from('mapping_global_subjects')
      .select('name, abbreviation, aliases, series, default_weekly_classes')
      .eq('school_id', assertActiveSchool(activeSchoolId));
    // Matriz curricular OFICIAL da série tem prioridade máxima como âncora.
    const parsedSeries = parseSeriesValue(series);
    if (!parsedSeries) {
      throw new Error('Defina a série da turma e aplique a matriz curricular oficial antes de importar o boletim.');
    }
    const classMatrix = await resolveClassMatrix(classItem.id, assertActiveSchool(activeSchoolId));
    const matrixItems = await fetchCurriculumMatrix(parsedSeries, activeSchoolId, classMatrix.id).catch(() => []);
    if (matrixItems.length === 0) {
      throw new Error(
        'A matriz curricular vinculada a esta turma não tem disciplinas para esta série. ' +
        'Cadastre os componentes em Disciplinas — Matriz Curricular (ou vincule outra matriz) e sincronize a turma antes de importar o boletim.',
      );
    }
    const official = matrixToExpectedSubjects(matrixItems);
    localExpectedRef.current = buildEffectiveSubjectMatrix({
      matrix: official,
      mapping: expected.map((s) => ({ name: s.name, weekly_classes: s.weekly_classes })),
      imported: (gradeSubj || []) as { name: string; weekly_classes: number | null }[],
      catalog: (catalog || []) as CatalogSubject[],
      series,
    });
    return { students, expected, className };
  }, [classItem, resolveCurrentClassName]);

  /**
   * Aluno sem match na turma: procura identidade forte (código ou nome exato) no restante do
   * sistema antes de permitir "cadastrar novo aluno" — evita duplicatas.
   */
  const lookupOtherClass = useCallback(async (detected: DetectedStudent, className: string) => {
    const code = digitsOnly(detected.pdf_code);
    const tokens = nameTokens(detected.pdf_name);
    const queries: PromiseLike<{ data: unknown[] | null }>[] = [];
    if (code) {
      queries.push(supabase
        .from('students')
        .select('id, full_name, class, school_code')
        .eq('school_id', assertActiveSchool(activeSchoolId))
        .neq('class', className)
        .ilike('school_code', `%${code}%`)
        .limit(50));
    }
    if (tokens.length > 0) {
      queries.push(supabase
        .from('students')
        .select('id, full_name, class, school_code')
        .eq('school_id', assertActiveSchool(activeSchoolId))
        .neq('class', className)
        .ilike('full_name', `%${tokens[0]}%`)
        .limit(200));
      if (tokens.length > 1) {
        queries.push(supabase
          .from('students')
          .select('id, full_name, class, school_code')
          .eq('school_id', assertActiveSchool(activeSchoolId))
          .neq('class', className)
          .ilike('full_name', `%${tokens[tokens.length - 1]}%`)
          .limit(200));
      }
    }
    if (queries.length === 0) return null;
    const results = await Promise.all(queries);
    const byId = new Map<string, { id: string; full_name: string; class: string; school_code: string | null }>();
    results.forEach((res) => (res.data || []).forEach((row) => {
      const s = row as { id: string; full_name: string; class: string; school_code: string | null };
      byId.set(s.id, s);
    }));
    const candidates = [...byId.values()];
    if (candidates.length === 0) return null;
    const { student, by } = findGlobalMatch(
      { name: detected.pdf_name, code: detected.pdf_code },
      candidates.map((s) => ({ ...s, school_code: s.school_code })),
    );
    if (!student || !by) return null;
    return { ...student, by } as OtherClassMatch;
  }, [activeSchoolId]);

  /**
   * Notas já existentes para o aluno desta página (aluno + disciplina + período).
   * Só é conflito quando o valor existente DIVERGE do valor lido do PDF.
   * Valores iguais (7,5 == 7,50; 0 == 0,00; null == vazio) são "match existente".
   */
  const loadPageConflicts = useCallback(async (studentId: string | null, p: PagePreview) => {
    if (!classItem || !studentId) { setConflictKeys(new Set()); setIdenticalKeys(new Set()); return; }
    const [subjRes, perRes] = await Promise.all([
      supabase.from('grade_subjects').select('id, normalized_name, slot_index').eq('school_id', assertActiveSchool(activeSchoolId)).eq('class_id', classItem.id),
      supabase.from('grade_periods').select('id, normalized_label').eq('school_id', assertActiveSchool(activeSchoolId)).eq('class_id', classItem.id),
    ]);
    // A ocorrência (slot) faz parte da identidade: a mesma disciplina pode aparecer
    // duas vezes na etapa (Matriz Integral) e cada ocorrência tem notas próprias.
    const subjById = new Map<string, { norm: string; slot: number }>();
    (subjRes.data || []).forEach((s: { id: string; normalized_name: string; slot_index: number | null }) =>
      subjById.set(s.id, { norm: s.normalized_name, slot: s.slot_index ?? 1 }));
    const perById = new Map<string, string>();
    (perRes.data || []).forEach((x: { id: string; normalized_label: string }) => perById.set(x.id, x.normalized_label));
    if (subjById.size === 0 || perById.size === 0) { setConflictKeys(new Set()); setIdenticalKeys(new Set()); return; }
    const { data } = await supabase
      .from('student_grades')
      .select('student_id, grade_subject_id, grade_period_id, value')
      .eq('school_id', assertActiveSchool(activeSchoolId))
      .eq('student_id', studentId);

    // Valores lidos do PDF por chave (aluno + disciplina + ocorrência + período)
    const pdfByKey = new Map<string, number | null>();
    (p.rows || []).forEach((r) => {
      if ((r.flags || []).includes('invalid_value')) return;
      pdfByKey.set(gradeConflictKey(studentId, r.subject, r.slot_index, r.period), r.value ?? null);
    });

    const divergent = new Set<string>();
    const identical = new Set<string>();
    (data || []).forEach((g: { student_id: string; grade_subject_id: string; grade_period_id: string; value: number | null }) => {
      const subj = subjById.get(g.grade_subject_id);
      const perNorm = perById.get(g.grade_period_id);
      if (!subj || !perNorm) return;
      const subject = p.subjects.find((s) => s.normalized_name === subj.norm && (s.slot_index ?? 1) === subj.slot);
      const period = p.periods.find((x) => x.normalized_label === perNorm);
      if (!subject || !period) return;
      const key = gradeConflictKey(g.student_id, subject.name, subj.slot, period.label);
      if (!pdfByKey.has(key)) return; // a página não trouxe essa combinação
      if (sameGradeValue(g.value ?? null, pdfByKey.get(key) ?? null)) identical.add(key);
      else divergent.add(key);
    });
    setConflictKeys(divergent);
    setIdenticalKeys(identical);
  }, [classItem, activeSchoolId]);

  const applyPreview = useCallback(async (p: PagePreview) => {
    p = keepOnlyPeriodColumns(p);
    setPreview(p);
    setRows((p.rows || []).map((r) => ({ ...r, flags: r.flags || [], source: r.source ?? 'import' })));
    setEditing(false);
    setConflictStrategy('keep');
    const detected = p.detected;
    setPageAction(detected.student_id ? 'link' : null);
    setLinkStudentId(detected.student_id ?? null);
    // Professor/funcionário não altera Código, nascimento e filiação: mantém sempre o cadastro.
    const baseDecision = defaultRegistrationDecision(detected);
    setRegDecision(canEditRegistration
      ? baseDecision
      : { code: 'keep', birth_date: 'keep', mother: 'keep', father: 'keep' });
    await loadPageConflicts(detected.student_id, p);
    const pdfClass = (p.pdf_class_code ?? '').trim();
    // O sufixo "Sala Fora" é diferenciação interna do registro: não gera conflito de turma.
    const divergent = Boolean(pdfClass) && !samePdfClassBaseName(pdfClass, effectiveName || classItem?.name || '');
    setClassDecision(divergent ? 'pending' : 'resolved');
    setOtherClassMatch(null);
    if (!detected.student_id) {
      try {
        const found = await lookupOtherClass(detected, effectiveNameRef.current || classItem?.name || '');
        if (found) {
          setOtherClassMatch(found);
          setPageAction(null);
        }
      } catch (e) {
        console.error('Busca global do aluno falhou:', e);
      }
    }
    setStep('page');
  }, [loadPageConflicts, lookupOtherClass, effectiveName, classItem, canEditRegistration]);

  /** Grava a prévia da leitura local na sessão (mesmo contrato da Edge Function). */
  const persistPreview = useCallback(async (sessionId: string, pageNumber: number, p: PagePreview) => {
    p = keepOnlyPeriodColumns(p);
    await supabase.from('grade_import_session_pages')
      .update({ status: 'awaiting_confirmation', preview_json: p as never, error: null })
      .eq('session_id', sessionId).eq('page_number', pageNumber);
    await supabase.from('grade_import_sessions')
      .update({ status: 'awaiting_confirmation', current_preview: p as never, current_page: pageNumber })
      .eq('id', sessionId);
  }, []);

  /** Leitura LOCAL determinística (texto + coordenadas), sem rede e sem IA. */
  const readPageLocally = useCallback(async (pageNumber: number) => {
    const doc = pdfDocRef.current;
    if (!doc) return null;
    const started = performance.now();
    const tokens = await extractPageTokens(doc, pageNumber);
    const result = parseGradePageLocal(tokens, {
      page: pageNumber,
      totalPages: doc.numPages,
      students: localStudentsRef.current,
      expectedSubjects: localExpectedRef.current,
    });
    const elapsed = Math.round(performance.now() - started);
    if (result.preview) result.preview.reading.duration_ms = elapsed;
    setLocalTimings((prev) => [...prev, elapsed]);
    return result;
  }, []);

  /** Processa UMA página: local primeiro, IA como validadora/fallback. */
  const processPage = useCallback(async (sessionId: string, pageNumber: number) => {
    setError(null);
    setStep('processing');
    setPreview(null);
    try {
      let local: Awaited<ReturnType<typeof readPageLocally>> = null;
      if (readingMode !== 'ai_only') {
        try {
          local = await readPageLocally(pageNumber);
        } catch (e) {
          console.error('Leitura local falhou, seguindo com IA:', e);
          local = null;
        }
      }
      if (cancelledRef.current) return;

      // Caminho 100% local: leitura AUTORITATIVA (sem risco real) dispensa a IA.
      const localOk = Boolean(local?.preview && local.ok);
      const localAuthoritative = Boolean(local?.authoritative);
      const useAi = shouldValidateWithAi({ mode: readingMode, localOk, localAuthoritative });
      if (!useAi && local?.preview) {
        const localPreview = local.preview as unknown as PagePreview;
        if (localPreview.reading) {
          localPreview.reading = {
            ...localPreview.reading, mode: 'local', authority: 'authoritative', ai_used: false,
          };
        }
        await persistPreview(sessionId, pageNumber, localPreview);
        setLocalSolvedPages((prev) => prev + 1);
        setSession((prev) => (prev ? { ...prev, current_page: pageNumber } : prev));
        await applyPreview(localPreview);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('parse-grade-page', {
        body: { action: 'page', session_id: sessionId, page_number: pageNumber },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao ler a página.');
      if (cancelledRef.current) return;
      const aiPreview = data.preview as PagePreview;

      let finalPreview = aiPreview;
      if (local?.preview && local.ok) {
        // A IA valida: a leitura local permanece visível e as divergências são sinalizadas.
        const { preview: merged, aiEmptyIgnored, aiOnlyNumericIgnored } = reconcileLocalWithAi(
          local.preview as unknown as PagePreview,
          aiPreview as unknown as { rows: ReviewRow[]; notes?: string[] },
          { localAuthoritative },
        );
        finalPreview = {
          ...merged,
          reading: merged.reading
            ? {
                ...merged.reading,
                ai_empty_ignored: aiEmptyIgnored,
                ai_only_numeric_ignored: aiOnlyNumericIgnored,
                anchored_subjects: (local.preview as unknown as PagePreview).reading?.anchored_subjects ?? [],
                merged_subject_lines: (local.preview as unknown as PagePreview).reading?.merged_subject_lines ?? 0,
              }
            : merged.reading,
        };
        await persistPreview(sessionId, pageNumber, finalPreview);
      } else if (finalPreview.reading) {
        finalPreview = {
          ...finalPreview,
          reading: { ...finalPreview.reading, mode: 'ai_fallback', local_score: local?.validation.score ?? 0,
            reasons: [...new Set([...(local?.validation.reasons ?? []), ...finalPreview.reading.reasons])] },
        };
      }

      setSession((prev) => (prev ? { ...prev, current_page: pageNumber } : prev));
      await applyPreview(finalPreview);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Erro ao ler a página.');
      setStep('failed');
    }
  }, [applyPreview, persistPreview, readPageLocally, readingMode]);

  /** Sessão em aberto para esta turma (retomada). */
  useEffect(() => {
    if (!open || !classItem) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('grade_import_sessions')
        .select('id, file_name, total_pages, current_page, confirmed_pages, ignored_pages, notes_imported, status, auto_accept, auto_accept_rules')
        .eq('school_id', assertActiveSchool(activeSchoolId))
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
        auto_accept_rules: parseAutoAcceptRules(data.auto_accept_rules),
      });
      setAutoAccept(Boolean(data.auto_accept));
      setAutoRules(parseAutoAcceptRules(data.auto_accept_rules));
      setStep('resume');
    })();
    return () => { cancelled = true; };
  }, [open, classItem, activeSchoolId]);

  useEffect(() => {
    if (open && classItem) {
      effectiveNameRef.current = classItem.name;
      setEffectiveName(classItem.name);
    }
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
      // Documento aberto UMA vez por sessão e reutilizado em todas as páginas.
      if (readingMode !== 'ai_only') {
        try {
          closePdfDocument(pdfDocRef.current);
          pdfDocRef.current = await openPdfDocument(await file.arrayBuffer());
        } catch (e) {
          console.error('Não foi possível abrir o PDF localmente:', e);
          pdfDocRef.current = null;
        }
      }
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
        auto_accept_rules: autoRules,
      };
      setSession(newSession);
      await supabase.from('grade_import_sessions')
        .update({ auto_accept: autoAccept, auto_accept_rules: autoRules as never })
        .eq('id', newSession.id);
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
        .eq('school_id', assertActiveSchool(activeSchoolId))
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
      // Flags de reconciliação antigas são descartadas e recalculadas contra a 2ª leitura.
      const flags = stripReconciliationFlags(row.flags)
        .filter((f) => !['invalid_value', 'low_confidence', 'empty_cell', 'out_of_scale'].includes(f));
      if (invalid) flags.push('invalid_value');
      if (!invalid && value == null) flags.push('empty_cell');
      if (value === 0) flags.push('explicit_zero');
      if (value != null && (value < 0 || value > 10)) flags.push('out_of_scale');
      if (row.second_pass_value !== undefined && row.second_pass_value !== null) {
        flags.push(matchesSecondPass(value, row.second_pass_value)
          ? 'reconciled_match'
          : 'reconciliation_divergence');
      }
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
  /** Erros reais que continuam bloqueando até a confirmação manual. */
  const manualBlockers = useMemo(() => manualConfirmationBlockers(rows), [rows]);
  /** Contagem ATUAL de divergências (reflete correções manuais), não o valor gravado na prévia. */
  const currentDivergenceCount = useMemo(() => analyzeDivergences(rows).divergences.length, [rows]);
  const pageHasConflicts = useMemo(
    () => rows.some((r) => targetStudentId && conflictKeys.has(`${targetStudentId}||${r.subject}||${r.period}`)),
    [rows, conflictKeys, targetStudentId],
  );

  const canConfirmPage =
    classDecision === 'resolved' &&
    invalidCount === 0 &&
    manualBlockers.length === 0 &&
    !otherClassMatch &&
    (pageAction === 'create' || (pageAction === 'link' && Boolean(linkStudentId)));

  /** Exceção cadastral vale apenas para quem pode alterar cadastro (RLS/trigger inalterados). */
  const registryExceptionActive = autoAccept && autoRules.use_pdf_registry && canEditRegistration;

  /** Avaliação estrita da autoaceitação da página atual (não grava nada). */
  const autoEval = useMemo(() => {
    if (!preview) {
      return {
        eligible: false, reasons: [] as string[], appliedExceptions: [] as string[],
        appliedExceptionCodes: [] as string[], divergences: [], divergenceOnlyBlocker: false,
      } as ReturnType<typeof evaluateAutoAccept>;
    }
    return evaluateAutoAccept({
      detected: preview.detected,
      rows,
      classDecisionPending: classDecision === 'pending',
      pageHasExistingGrades: pageHasConflicts,
      linkedStudentId: pageAction === 'link' ? linkStudentId : null,
      suggestedStudentId: preview.detected.student_id,
      regDecision,
      rules: autoRules,
      canUsePdfRegistry: canEditRegistration,
      otherClassMatch: Boolean(otherClassMatch),
      contextBlocked: Boolean(contextBlock),
    });
  }, [
    preview, rows, classDecision, pageHasConflicts, pageAction, linkStudentId, regDecision,
    autoRules, canEditRegistration, otherClassMatch, contextBlock,
  ]);

  /** Diagnóstico das divergências LOCAL × IA — sempre visível, independente do modo automático. */
  const divergenceDiag = useMemo(() => analyzeDivergences(rows), [rows]);
  const otherBlockers = useMemo(
    () => autoEval.reasons.filter((r) => r !== 'Divergência entre leituras'),
    [autoEval.reasons],
  );

  /**
   * Exceção: aluno não identificado pode ser vinculado/criado automaticamente.
   * Jamais vale com aluno ambíguo/homônimo na turma.
   */
  const unmatchedExceptionActive = Boolean(
    autoAccept
    && autoRules.auto_create_or_link_unmatched_student
    && preview
    && !preview.detected.conflicts.includes('ambiguous_match')
    && !preview.detected.conflicts.includes('duplicate_link'),
  );

  /**
   * Resolução automática do aluno da página quando a exceção está ativa:
   * move o candidato único de outra turma, vincula o sugerido ou cria pelo boletim.
   * Erros reais de nota continuam bloqueando (nada é gravado aqui).
   */
  useEffect(() => {
    if (step !== 'page' || !preview || !session) return;
    if (!unmatchedExceptionActive) return;
    if (!autoEval.eligible || canConfirmPage) return;
    if (invalidCount > 0 || manualBlockers.length > 0) return;
    const key = `${session.id}:${preview.page}`;
    if (autoStudentRef.current === key) return;
    autoStudentRef.current = key;
    if (otherClassMatch) {
      if (!movingStudent) void handleMoveStudentToClass();
      return;
    }
    if (preview.detected.student_id) {
      setPageAction('link');
      setLinkStudentId(preview.detected.student_id);
      return;
    }
    setPageAction('create');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, preview, session, unmatchedExceptionActive, autoEval.eligible, canConfirmPage,
    invalidCount, manualBlockers.length, otherClassMatch, movingStudent,
  ]);

  /** Ação contextual: adota a leitura local do boletim e retoma o fluxo automático. */
  const handleUseLocalReading = async () => {
    setApplyingLocalReading(true);
    try {
      if (!autoAccept) await handleToggleAutoAccept(true);
      await handleToggleRule('use_local_on_reconciliation', true);
      if (otherBlockers.length > 0) {
        toast.warning('Leitura local adotada, mas ainda existem outras pendências nesta página.');
      } else {
        toast.info('Leitura local do boletim adotada — continuando automaticamente.');
      }
    } finally {
      setApplyingLocalReading(false);
    }
  };

  /**
   * Exceção A ativa: a decisão cadastral da página passa a ser "Atualizar pelo boletim"
   * em todo campo presente no PDF (inclusive quando o cadastro está vazio).
   */
  useEffect(() => {
    if (!registryExceptionActive || !preview) return;
    const d = preview.detected;
    setRegDecision({
      code: d.pdf_code ? 'update' : 'keep',
      birth_date: d.pdf_birth_date ? 'update' : 'keep',
      mother: d.pdf_mother_name ? 'update' : 'keep',
      father: d.pdf_father_name ? 'update' : 'keep',
    });
  }, [registryExceptionActive, preview]);

  /** Persiste a preferência na sessão para valer também ao retomar. */
  const handleToggleAutoAccept = async (value: boolean) => {
    setAutoAccept(value);
    if (session) {
      await supabase.from('grade_import_sessions').update({ auto_accept: value }).eq('id', session.id);
      setSession((prev) => (prev ? { ...prev, auto_accept: value } : prev));
    }
  };

  /** Persiste as exceções por sessão (retomada mantém a mesma configuração). */
  const handleToggleRule = async (rule: keyof AutoAcceptRules, value: boolean) => {
    const next = { ...autoRules, [rule]: value };
    setAutoRules(next);
    if (session) {
      await supabase.from('grade_import_sessions')
        .update({ auto_accept_rules: next as never })
        .eq('id', session.id);
      setSession((prev) => (prev ? { ...prev, auto_accept_rules: next } : prev));
    }
  };

  /** Renomeia a turma para o nome do PDF (com auditoria) — nunca automático. */
  const handleRenameClass = async (salaFora = false) => {
    if (!classItem || !preview?.pdf_class_code) return;
    setRenamingClass(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const oldName = effectiveName || classItem.name;
      const newName = resolveClassNameFromPdf(preview.pdf_class_code, salaFora);
      const schoolId = assertActiveSchool(activeSchoolId);
      // Turma: sempre por id + escola ativa (nome de turma nunca é identificador global).
      const { error: classError } = await supabase
        .from('classes')
        .update({ name: newName })
        .eq('id', classItem.id)
        .eq('school_id', schoolId);
      if (classError) throw classError;
      // Alunos: nome antigo SOMENTE dentro da escola ativa (escolas podem ter turmas homônimas).
      const { error: studentsError } = await supabase
        .from('students')
        .update({ class: newName })
        .eq('school_id', schoolId)
        .eq('class', oldName);
      if (studentsError) throw studentsError;

      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id ?? null,
        action: 'UPDATE',
        table_name: 'classes',
        record_id: classItem.id,
        old_data: { name: oldName } as never,
        new_data: { name: newName, reason: 'Divergência de turma no boletim importado (página a página)', page: preview.page } as never,
      });
      effectiveNameRef.current = newName;
      setEffectiveName(newName);
      // Recarrega o contexto com o nome NOVO: sem isso os alunos ficam invisíveis para o matching.
      try {
        await loadContext();
        if (preview) await applyPreview(preview);
      } catch (e) {
        console.error('Não foi possível recarregar o contexto após renomear a turma:', e);
      }
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

  /** Move para esta turma o aluno já cadastrado em outra turma (evita duplicidade). */
  const handleMoveStudentToClass = async () => {
    if (!classItem || !otherClassMatch) return;
    setMovingStudent(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const target = effectiveNameRef.current || classItem.name;
      const previousClass = otherClassMatch.class;
      const { error: moveError } = await supabase
        .from('students')
        .update({ class: target })
        .eq('id', otherClassMatch.id)
        .eq('school_id', assertActiveSchool(activeSchoolId));

      if (moveError) throw moveError;
      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id ?? null,
        action: 'UPDATE',
        table_name: 'students',
        record_id: otherClassMatch.id,
        old_data: { class: previousClass } as never,
        new_data: { class: target, reason: 'Aluno localizado em outra turma durante importação de boletim' } as never,
      });
      await loadContext();
      setOtherClassMatch(null);
      setPageAction('link');
      setLinkStudentId(otherClassMatch.id);
      toast.success(`${otherClassMatch.full_name} movido de ${previousClass} para ${target}.`);
      onImported?.();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Não foi possível mover o aluno para esta turma.');
    } finally {
      setMovingStudent(false);
    }
  };

  /** Recarrega turma e contexto após falha de carregamento (guarda de contexto vazio). */
  const handleReloadContext = async () => {
    try {
      await loadContext();
      setContextBlock(null);
      setStep(session ? 'resume' : 'select');
      onImported?.();
      toast.success('Contexto da turma recarregado.');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CONTEXT_EMPTY')) console.error(e);
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
            school_id: assertActiveSchool(activeSchoolId),
            full_name: detected.pdf_name,
            student_id: `${initials}-${effectiveName || classItem.name}-${shiftCode}`,
            class: effectiveName || classItem.name,
            shift: classItem.shift as never,
            qr_code: `STU-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            school_code: sanitizeSchoolCodeForStorage(detected.pdf_code),
            birth_date: detected.pdf_birth_date,
            mother_name: detected.pdf_mother_name,
            father_name: detected.pdf_father_name,
            created_by: userId,
          })
          .select('id')
          .single();
        if (createError) throw createError;
        studentId = created.id;
        // Contexto local passa a conhecer o aluno recém-criado (páginas seguintes).
        setClassStudents((prev) =>
          prev.some((s) => s.id === created.id) ? prev : [...prev, { id: created.id, full_name: detected.pdf_name }]);
        if (!localStudentsRef.current.some((s) => s.id === created.id)) {
          localStudentsRef.current = [...localStudentsRef.current, {
            id: created.id,
            full_name: detected.pdf_name,
            student_id: `${initials}-${effectiveName || classItem.name}-${shiftCode}`,
            school_code: sanitizeSchoolCodeForStorage(detected.pdf_code),
            birth_date: detected.pdf_birth_date,
            mother_name: detected.pdf_mother_name,
            father_name: detected.pdf_father_name,
          }];
        }
      }
      if (!studentId) throw new Error('Selecione o aluno correspondente antes de salvar a página.');

      // Períodos e disciplinas desta página
      const periodPayload = preview.periods
        .filter((p) => columnIsPeriod(p.label, p.kind))
        .map((p) => ({
        school_id: assertActiveSchool(activeSchoolId),
        class_id: classItem.id,
        label: p.label,
        normalized_label: p.normalized_label || normalize(p.label),
        kind: 'period',
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
        .select('id, name, normalized_name, slot_index, include_in_ira, custom_ira_weight, legacy_excluded')
        .eq('school_id', assertActiveSchool(activeSchoolId))
        .eq('class_id', classItem.id);
      type ExistingSubjectRow = {
        id: string; name: string; normalized_name: string; slot_index: number | null;
        include_in_ira: boolean; custom_ira_weight: number | null; legacy_excluded: boolean | null;
      };
      const existingRows = (existingSubjects || []) as ExistingSubjectRow[];
      // Cada ocorrência (slot) da mesma disciplina é uma linha própria de grade_subjects.
      const slotOf = (s: { slot_index?: number | null }) => s.slot_index ?? 1;
      const existingByNorm = new Map<string, { include_in_ira: boolean; custom_ira_weight: number | null }>();
      existingRows.forEach((s) =>
        existingByNorm.set(`${s.normalized_name}#${slotOf(s)}`, {
          include_in_ira: s.include_in_ira, custom_ira_weight: s.custom_ira_weight,
        }));
      // Reuso canônico: CHL/CNS/ETT são apenas aliases; nunca criam novos grade_subjects.
      const activeByCanonical = new Map<string, ExistingSubjectRow>();
      existingRows
        .filter((s) => !s.legacy_excluded)
        .forEach((s) => {
          const key = `${canonicalSubjectKey(s.name)}#${slotOf(s)}`;
          const current = activeByCanonical.get(key);
          if (!current || normalize(s.name) === canonicalSubjectKey(s.name)) activeByCanonical.set(key, s);
        });

      /** `normalized_name#slot` lido do PDF -> `normalized_name#slot` efetivamente gravado. */
      const subjectNormRedirect = new Map<string, string>();
      const subjectPayload: Record<string, unknown>[] = [];
      const seenNorms = new Set<string>();
      preview.subjects.forEach((s) => {
        const expected = s.matched_expected ? expectedSubjects.find((e) => e.name === s.matched_expected) : undefined;
        const slot = s.slot_index ?? 1;
        const readNorm = s.normalized_name || normalize(s.name);
        const canonicalMatch = activeByCanonical.get(`${canonicalSubjectKey(s.name)}#${slot}`);
        const name = canonicalMatch?.name ?? s.name;
        const normalized_name = canonicalMatch?.normalized_name ?? readNorm;
        const targetKey = `${normalized_name}#${slot}`;
        subjectNormRedirect.set(`${readNorm}#${slot}`, targetKey);
        // Identidade canônica também redireciona: linha lida com eixo (CNS/CHL/ETT)
        // aponta para o mesmo grade_subject do nome canônico.
        subjectNormRedirect.set(`${canonicalSubjectKey(s.name)}#${slot}`, targetKey);
        const previous = existingByNorm.get(targetKey);
        const weekly = expected?.weekly_classes ?? s.weekly_classes ?? null;
        if (seenNorms.has(targetKey)) return;
        seenNorms.add(targetKey);
        subjectPayload.push({
          school_id: assertActiveSchool(activeSchoolId),
          class_id: classItem.id,
          name,
          normalized_name,
          slot_index: slot,
          mapping_class_subject_id: expected?.id ?? null,
          weekly_classes: weekly,
          include_in_ira: previous?.include_in_ira ?? (weekly === 1 || weekly === 2 || weekly === 4),
          custom_ira_weight: previous?.custom_ira_weight ?? null,
          sort_order: s.sort_order,
        });
      });
      const subjectIdByNorm = new Map<string, string>();
      if (subjectPayload.length > 0) {
        const { data: subjectRows, error: subjectError } = await supabase
          .from('grade_subjects')
          .upsert(subjectPayload as never, { onConflict: 'class_id,normalized_name,slot_index' })
          .select('id, normalized_name, slot_index');
        if (subjectError) throw subjectError;
        (subjectRows || []).forEach((s: { id: string; normalized_name: string; slot_index: number | null }) =>
          subjectIdByNorm.set(`${s.normalized_name}#${slotOf(s)}`, s.id));
      }
      if (preview.subjects.length > 0 && subjectIdByNorm.size === 0) {
        throw new Error(
          'Nenhuma disciplina de destino foi encontrada para esta turma. Sincronize a matriz curricular ' +
          'da turma em Disciplinas — Matriz Curricular antes de importar o boletim.',
        );
      }
      const subjectIdForRow = (subjectName: string, slotIndex?: number | null) => {
        const slot = slotIndex ?? 1;
        const norm = `${normalize(subjectName)}#${slot}`;
        const canonical = `${canonicalSubjectKey(subjectName)}#${slot}`;
        const target = subjectNormRedirect.get(norm) ?? subjectNormRedirect.get(canonical) ?? norm;
        return subjectIdByNorm.get(target);
      };


      // Confirmação manual é SOBERANA: apenas leitura local/edições manuais,
      // sem linhas da IA e sem flags de reconciliação no payload acadêmico.
      const academicRows = mode === 'manual' ? rowsForManualLocalConfirmation(rows) : rows;

      // Notas da página (vazio = null; 0,00 = zero real; faltas nunca chegam aqui)
      const payload = academicRows
        .filter((r) => !r.flags.includes('invalid_value'))
        .map((row) => {
          const subjectId = subjectIdForRow(row.subject, row.slot_index);
          const periodId = periodIdByNorm.get(normalize(row.period));
          if (!subjectId || !periodId) return null;
          return {
            school_id: assertActiveSchool(activeSchoolId),
            student_id: studentId as string,
            grade_subject_id: subjectId,
            grade_period_id: periodId,
            value: row.value,
            raw_text: row.raw_value,
            confidence: row.confidence,
            flags: row.flags,
            source: row.source === 'manual' ? 'manual' : 'import',
            conflictKey: gradeConflictKey(studentId as string, row.subject, row.slot_index, row.period),
          };
        })
        .filter(Boolean) as (Record<string, unknown> & { conflictKey: string })[];

      // Idênticos já existentes: não regravar (idempotente). Divergentes seguem a estratégia escolhida.
      // Exceção explícita do usuário: nota do PDF autorizada a substituir a existente.
      const withoutIdentical = payload.filter((g) => !identicalKeys.has(g.conflictKey));
      const overwriteExisting = conflictStrategy === 'overwrite' || autoRules.use_pdf_grade_on_existing_conflict;
      const filtered = overwriteExisting
        ? withoutIdentical
        : withoutIdentical.filter((g) => !conflictKeys.has(g.conflictKey));

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
        const storedCode = sanitizeSchoolCodeForStorage(detected.pdf_code);
        if (storedCode && regDecision.code === 'update') update.school_code = storedCode;
        if (detected.pdf_birth_date && regDecision.birth_date === 'update') update.birth_date = detected.pdf_birth_date;
        if (detected.pdf_mother_name && regDecision.mother === 'update') update.mother_name = detected.pdf_mother_name;
        if (detected.pdf_father_name && regDecision.father === 'update') update.father_name = detected.pdf_father_name;
        if (Object.keys(update).length > 0) {
          const { error: updError } = await supabase.from('students').update(update).eq('id', studentId);
          if (updError) throw updError;
          // Auditoria explícita quando a alteração veio do autoaceite do boletim.
          if (mode === 'auto') {
            await supabase.from('audit_logs').insert({
              user_id: userId,
              action: 'UPDATE',
              table_name: 'students',
              record_id: studentId,
              new_data: {
                ...update,
                reason: 'Autoaceite do boletim — exceção “usar dados do boletim”',
                session_id: session.id,
                page: preview.page,
              } as never,
            });
          }
        }
      }

      await supabase.from('grade_import_session_pages')
        .update({
          status: 'confirmed',
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
          confirmation_mode: mode === 'auto'
            ? (autoEval.appliedExceptionCodes.length > 0
              ? `auto:${autoEval.appliedExceptionCodes.join(',')}`
              : 'auto')
            : 'manual:local_confirmed',
          preview_json: {
            ...preview,
            rows: academicRows,
            reading: preview.reading
              ? { ...preview.reading, divergences: 0, resolved_by: 'manual_local_confirmation' }
              : preview.reading,
          } as never,
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
      // Não recalcula IRA aqui: apenas marca o escopo como desatualizado.
      if (finalPayload.length > 0) {
        try {
          await markIraStale(classItem.id, 'Boletim importado', activeSchoolId);
          toast.warning(
            'Boletim importado. O IRA e as medalhas estão desatualizados. Acesse Alunos e clique em Atualizar IRA.',
            { duration: 8000 },
          );
        } catch (staleErr) {
          console.error('Falha ao marcar IRA como desatualizado:', staleErr);
        }
      }
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
            {classItem && (
              <ClassCurriculumGate
                classId={classItem.id}
                onReadyChange={setCurriculumReady}
              />
            )}
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
              <Button onClick={() => fileInputRef.current?.click()} disabled={!curriculumReady}>
                <Upload className="w-4 h-4 mr-2" />
                Selecionar PDF
              </Button>
              {!curriculumReady && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  Defina a série e aplique a matriz curricular oficial acima para liberar a importação.
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-sm font-medium">Modo de leitura</Label>
              <Select value={readingMode} onValueChange={(v) => setReadingMode(v as ReadingMode)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[320px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_ai">{READING_MODE_LABELS.local_ai}</SelectItem>
                  <SelectItem value="always_ai">{READING_MODE_LABELS.always_ai}</SelectItem>
                  <SelectItem value="ai_only">{READING_MODE_LABELS.ai_only}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                No modo padrão a página é lida no próprio dispositivo por texto e coordenadas; a IA só entra quando a
                leitura local não é conclusiva e atua como validadora — nunca substitui a leitura local sem aviso.
              </p>
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

        {step === 'context_error' && contextBlock && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle className="text-sm">Não foi possível carregar os alunos desta turma</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  A turma <span className="font-medium">{contextBlock.className}</span> tem {contextBlock.found} aluno(s)
                  no sistema, mas a consulta retornou lista vazia. Importar agora marcaria todos como “não identificados”.
                </p>
                <p>Nenhuma nota foi gravada. Recarregue a turma e tente novamente.</p>
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleReloadContext}>Recarregar turma</Button>
              <Button variant="ghost" onClick={handleCancelSession}>Cancelar importação</Button>
            </div>
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
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge
                    variant={preview.reading.mode === 'local' ? 'outline' : 'secondary'}
                    className="text-[10px]"
                  >
                    {preview.reading.mode === 'local'
                      ? 'Leitura local'
                      : preview.reading.mode === 'local_validated'
                        ? 'Leitura local + validação IA'
                        : preview.reading.mode === 'ai_fallback'
                          ? 'Leitura por IA (fallback)'
                          : preview.reading.escalated ? 'Validação adicional aplicada' : 'Lida em modo rápido'}
                  </Badge>
                  {preview.reading.duration_ms != null && (
                    <span className="text-[10px] text-muted-foreground">{preview.reading.duration_ms}ms</span>
                  )}
                  {currentDivergenceCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {currentDivergenceCount} divergência(s) local × IA
                    </Badge>
                  )}
                </div>
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
                <div className="rounded-md border bg-muted/40 p-2 space-y-2">
                  <p className="text-[11px] font-medium">Exceções permitidas (ignorar estes avisos no modo automático)</p>
                  <div className="flex items-start gap-2">
                    <Switch
                      id="rule-registry"
                      className="mt-0.5"
                      checked={autoRules.use_pdf_registry && canEditRegistration}
                      disabled={!canEditRegistration}
                      onCheckedChange={(v) => handleToggleRule('use_pdf_registry', v)}
                    />
                    <div>
                      <Label htmlFor="rule-registry" className="text-xs font-medium">
                        Dados cadastrais divergentes — usar automaticamente os dados do boletim
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Código, data de nascimento, nome da mãe e nome do pai são atualizados pelo boletim (inclusive
                        quando o cadastro está vazio) e a alteração fica registrada na auditoria.
                        {!canEditRegistration && ' Disponível apenas para administração e direção.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Switch
                      id="rule-fuzzy"
                      className="mt-0.5"
                      checked={autoRules.accept_unique_fuzzy}
                      onCheckedChange={(v) => handleToggleRule('accept_unique_fuzzy', v)}
                    />
                    <div>
                      <Label htmlFor="rule-fuzzy" className="text-xs font-medium">
                        Nome semelhante com candidato único — aceitar vínculo sugerido automaticamente
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Vale somente para semelhança ≥ 0,85 com exatamente um aluno da turma. Homônimos, ambiguidade e
                        aluno de outra turma continuam exigindo decisão manual.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Switch
                      id="rule-local-reconciliation"
                      className="mt-0.5"
                      checked={autoRules.use_local_on_reconciliation}
                      onCheckedChange={(v) => handleToggleRule('use_local_on_reconciliation', v)}
                    />
                    <div>
                      <Label htmlFor="rule-local-reconciliation" className="text-xs font-medium">
                        Divergência entre leituras — usar a leitura local do boletim
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Grava exatamente o valor extraído do PDF (leitura local), usando a IA apenas como validação.
                        Só vale quando a célula é estruturalmente válida: valor entre 0 e 10 ou vazio legítimo, sem
                        baixa confiança, valor inválido, duplicidade conflitante ou disciplina ausente. Células vistas
                        somente pela IA nunca são aceitas automaticamente.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Switch
                      id="rule-pdf-grade-existing"
                      className="mt-0.5"
                      checked={autoRules.use_pdf_grade_on_existing_conflict}
                      onCheckedChange={(v) => handleToggleRule('use_pdf_grade_on_existing_conflict', v)}
                    />
                    <div>
                      <Label htmlFor="rule-pdf-grade-existing" className="text-xs font-medium">
                        Usar automaticamente a nota do boletim quando divergir da nota já salva
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Quando aluno + disciplina + período coincidirem, a nota do PDF substituirá a nota existente
                        apenas se esta opção estiver ativada. Vale somente para essa divergência: células inválidas,
                        fora da escala, aluno ambíguo ou disciplina não resolvida continuam bloqueando.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Switch
                      id="rule-unmatched-student"
                      className="mt-0.5"
                      checked={autoRules.auto_create_or_link_unmatched_student}
                      onCheckedChange={(v) => handleToggleRule('auto_create_or_link_unmatched_student', v)}
                    />
                    <div>
                      <Label htmlFor="rule-unmatched-student" className="text-xs font-medium">
                        Aluno não identificado — vincular ou cadastrar automaticamente pelo boletim
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Quando o aluno da página não estiver na turma, o sistema vincula o candidato único
                        (movendo-o para esta turma, se estiver em outra) ou cria o cadastro com os dados do boletim.
                        Nunca vale para aluno ambíguo ou homônimo, e notas inválidas, fora da escala ou com
                        divergência continuam bloqueando a página.
                      </p>
                    </div>
                  </div>
                </div>

              )}

              {autoAccept && autoEval.appliedExceptions.length > 0 && (
                <p className="text-[11px] text-amber-600">
                  Exceções aplicadas nesta página: {autoEval.appliedExceptions.join(' · ')}
                </p>
              )}
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

            {divergenceDiag.hasDivergence && (
              <GradesDivergencePanel
                divergences={divergenceDiag.divergences}
                ruleActive={autoRules.use_local_on_reconciliation}
                allLocallyEligible={divergenceDiag.allLocallyEligible}
                hasOtherBlockers={otherBlockers.length > 0}
                applying={applyingLocalReading}
                onUseLocalReading={handleUseLocalReading}
                aiEmptyIgnored={preview.reading?.ai_empty_ignored ?? 0}
                anchoredSubjects={preview.reading?.anchored_subjects ?? []}
                advisoryOnly={divergenceDiag.onlyAdvisory}
                aiOnlyNumericIgnored={preview.reading?.ai_only_numeric_ignored ?? 0}
              />
            )}
            {!divergenceDiag.hasDivergence
              && ((preview.reading?.ai_empty_ignored ?? 0) > 0
                || (preview.reading?.ai_only_numeric_ignored ?? 0) > 0
                || (preview.reading?.anchored_subjects?.length ?? 0) > 0) && (
              <GradesDivergencePanel
                divergences={[]}
                ruleActive={autoRules.use_local_on_reconciliation}
                allLocallyEligible
                hasOtherBlockers={false}
                aiEmptyIgnored={preview.reading?.ai_empty_ignored ?? 0}
                anchoredSubjects={preview.reading?.anchored_subjects ?? []}
                aiOnlyNumericIgnored={preview.reading?.ai_only_numeric_ignored ?? 0}
              />
            )}
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
              {otherClassMatch && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle className="text-sm">Este aluno já existe em outra turma</AlertTitle>
                  <AlertDescription className="text-xs space-y-2">
                    <p>
                      <span className="font-medium">{otherClassMatch.full_name}</span> está cadastrado na turma{' '}
                      <span className="font-medium">{otherClassMatch.class}</span>
                      {otherClassMatch.school_code ? ` (Código ${otherClassMatch.school_code})` : ''} — identificado por{' '}
                      {otherClassMatch.by === 'code' ? 'Código do boletim' : 'nome idêntico'}.
                      Cadastrar novo aluno criaria duplicidade.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={handleMoveStudentToClass} disabled={movingStudent}>
                        {movingStudent && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                        Mover para {effectiveName || classItem.name}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleIgnorePage} disabled={movingStudent}>
                        Manter na turma atual e ignorar esta página
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOtherClassMatch(null)} disabled={movingStudent}>
                        Decidir manualmente
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
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
                  disabled={Boolean(otherClassMatch)}
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
                  Notas existentes divergem das notas do PDF em algumas disciplinas/períodos desta página
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Notas idênticas já gravadas são preservadas automaticamente e não exigem decisão.
                </p>
                {autoRules.use_pdf_grade_on_existing_conflict ? (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Nota do PDF autorizada para substituir a existente (exceção do modo automático ativada).
                  </p>
                ) : (
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
                )}

              </div>
            )}

            {pageAction === 'link' && linkStudentId === preview.detected.student_id && regDecision && (
              <GradesRegistrationAudit
                entries={[preview.detected]}
                decisions={{ [preview.detected.key]: regDecision }}
                canEdit={canEditRegistration}
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
            {localTimings.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Leitura local: {localSolvedPages} página(s) resolvida(s) sem IA ·
                {' '}tempo médio {Math.round(localTimings.reduce((a, b) => a + b, 0) / localTimings.length)}ms por página.
              </p>
            )}
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
                {divergenceDiag.hasDivergence
                  ? 'Confirmar leitura local e próxima página'
                  : 'Confirmar e próxima página'}
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
