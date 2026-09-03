-- Marca staleness a partir de uma nota (resolve turma/escola pela disciplina)
CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject uuid;
  v_class uuid;
  v_school uuid;
BEGIN
  v_subject := COALESCE(NEW.grade_subject_id, OLD.grade_subject_id);
  SELECT gs.class_id, gs.school_id INTO v_class, v_school
  FROM public.grade_subjects gs WHERE gs.id = v_subject;
  IF v_class IS NOT NULL AND v_school IS NOT NULL THEN
    INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
    VALUES (v_school, v_class, true, 'Notas alteradas', now())
    ON CONFLICT (class_id) DO UPDATE
      SET stale = true, reason = 'Notas alteradas', marked_at = now(), updated_at = now();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Marca staleness a partir de configuração vinculada a uma turma
CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_class_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_school uuid;
BEGIN
  v_class := COALESCE(NEW.class_id, OLD.class_id);
  v_school := COALESCE(NEW.school_id, OLD.school_id);
  IF v_class IS NOT NULL AND v_school IS NOT NULL THEN
    INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
    VALUES (v_school, v_class, true, 'Configuracao do IRA alterada', now())
    ON CONFLICT (class_id) DO UPDATE
      SET stale = true, reason = 'Configuracao do IRA alterada', marked_at = now(), updated_at = now();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Marca staleness das turmas da mesma serie na mesma escola (matriz curricular)
CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_matrix()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_series text;
BEGIN
  v_school := COALESCE(NEW.school_id, OLD.school_id);
  v_series := COALESCE(NEW.series, OLD.series);
  IF v_school IS NULL OR v_series IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
  SELECT c.school_id, c.id, true, 'Matriz curricular alterada', now()
  FROM public.classes c
  WHERE c.school_id = v_school AND c.series = v_series
  ON CONFLICT (class_id) DO UPDATE
    SET stale = true, reason = 'Matriz curricular alterada', marked_at = now(), updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ira_stale_student_grades ON public.student_grades;
CREATE TRIGGER trg_ira_stale_student_grades
AFTER INSERT OR DELETE ON public.student_grades
FOR EACH ROW EXECUTE FUNCTION public.mark_ira_stale_from_grade();

DROP TRIGGER IF EXISTS trg_ira_stale_student_grades_upd ON public.student_grades;
CREATE TRIGGER trg_ira_stale_student_grades_upd
AFTER UPDATE ON public.student_grades
FOR EACH ROW
WHEN (
  NEW.value IS DISTINCT FROM OLD.value
  OR NEW.grade_subject_id IS DISTINCT FROM OLD.grade_subject_id
  OR NEW.grade_period_id IS DISTINCT FROM OLD.grade_period_id
)
EXECUTE FUNCTION public.mark_ira_stale_from_grade();

DROP TRIGGER IF EXISTS trg_ira_stale_ira_settings ON public.ira_settings;
CREATE TRIGGER trg_ira_stale_ira_settings
AFTER INSERT OR UPDATE OR DELETE ON public.ira_settings
FOR EACH ROW EXECUTE FUNCTION public.mark_ira_stale_from_class_config();

DROP TRIGGER IF EXISTS trg_ira_stale_grade_subjects ON public.grade_subjects;
CREATE TRIGGER trg_ira_stale_grade_subjects
AFTER INSERT OR UPDATE OR DELETE ON public.grade_subjects
FOR EACH ROW EXECUTE FUNCTION public.mark_ira_stale_from_class_config();

DROP TRIGGER IF EXISTS trg_ira_stale_grade_periods ON public.grade_periods;
CREATE TRIGGER trg_ira_stale_grade_periods
AFTER INSERT OR UPDATE OR DELETE ON public.grade_periods
FOR EACH ROW EXECUTE FUNCTION public.mark_ira_stale_from_class_config();

DROP TRIGGER IF EXISTS trg_ira_stale_matrix ON public.curriculum_matrix_subjects;
CREATE TRIGGER trg_ira_stale_matrix
AFTER INSERT OR UPDATE OR DELETE ON public.curriculum_matrix_subjects
FOR EACH ROW EXECUTE FUNCTION public.mark_ira_stale_from_matrix();