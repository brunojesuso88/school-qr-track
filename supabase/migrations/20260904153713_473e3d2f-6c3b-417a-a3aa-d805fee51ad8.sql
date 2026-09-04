-- 6) subject_id da matriz precisa pertencer à MESMA escola
CREATE TRIGGER trg_cms_subject_same_school
  BEFORE INSERT OR UPDATE ON public.curriculum_matrix_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_school_match('mapping_global_subjects', 'subject_id');

-- 7) matriz em uso por turmas não pode ser excluída
CREATE OR REPLACE FUNCTION public.block_delete_matrix_in_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_classes int;
BEGIN
  IF OLD.is_original THEN
    RAISE EXCEPTION 'A Matriz Original da escola nao pode ser excluida';
  END IF;
  SELECT count(*) INTO v_classes FROM public.classes WHERE curriculum_matrix_id = OLD.id;
  IF v_classes > 0 THEN
    RAISE EXCEPTION 'Esta matriz curricular esta vinculada a % turma(s). Sincronize essas turmas com outra matriz antes de excluir.', v_classes;
  END IF;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.block_delete_matrix_in_use() FROM public, anon, authenticated;

CREATE TRIGGER trg_curriculum_matrices_block_delete_in_use
  BEFORE DELETE ON public.curriculum_matrices
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_matrix_in_use();

-- 8) staleness do IRA restrito às turmas que realmente usam a matriz alterada
CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_matrix()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school uuid;
  v_series text;
  v_matrix uuid;
BEGIN
  v_school := COALESCE(NEW.school_id, OLD.school_id);
  v_series := COALESCE(NEW.series, OLD.series);
  v_matrix := COALESCE(NEW.matrix_id, OLD.matrix_id);
  IF v_school IS NULL OR v_series IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
  SELECT c.school_id, c.id, true, 'Matriz curricular alterada', now()
    FROM public.classes c
   WHERE c.school_id = v_school
     AND c.series = v_series
     AND (
       v_matrix IS NULL
       OR c.curriculum_matrix_id = v_matrix
       OR (c.curriculum_matrix_id IS NULL AND EXISTS (
            SELECT 1 FROM public.curriculum_matrices m
             WHERE m.id = v_matrix AND m.school_id = v_school AND m.is_original))
     )
  ON CONFLICT (class_id) DO UPDATE
    SET stale = true, reason = 'Matriz curricular alterada', marked_at = now(), updated_at = now();

  RETURN COALESCE(NEW, OLD);
END $$;