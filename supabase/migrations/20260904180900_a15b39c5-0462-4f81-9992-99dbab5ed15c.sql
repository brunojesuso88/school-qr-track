CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_class_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_class uuid;
  v_school uuid;
BEGIN
  v_class := COALESCE(NEW.class_id, OLD.class_id);
  v_school := COALESCE(NEW.school_id, OLD.school_id);
  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Em exclusões em cascata a turma já não existe: não recriar a marcação.
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_class) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
  VALUES (v_school, v_class, true, 'Configuracao do IRA alterada', now())
  ON CONFLICT (class_id) DO UPDATE
    SET stale = true, reason = 'Configuracao do IRA alterada', marked_at = now(), updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_ira_stale_from_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subject uuid;
  v_class uuid;
  v_school uuid;
BEGIN
  v_subject := COALESCE(NEW.grade_subject_id, OLD.grade_subject_id);
  IF v_subject IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT gs.class_id, gs.school_id INTO v_class, v_school
  FROM public.grade_subjects gs WHERE gs.id = v_subject;
  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_class) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.ira_staleness (school_id, class_id, stale, reason, marked_at)
  VALUES (v_school, v_class, true, 'Notas alteradas', now())
  ON CONFLICT (class_id) DO UPDATE
    SET stale = true, reason = 'Notas alteradas', marked_at = now(), updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$function$;