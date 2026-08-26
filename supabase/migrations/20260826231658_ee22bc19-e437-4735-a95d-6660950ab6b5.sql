CREATE OR REPLACE FUNCTION public.grade_subject_ids_with_grades(_subject_ids uuid[])
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT DISTINCT sg.grade_subject_id
      FROM public.student_grades sg
     WHERE sg.grade_subject_id = ANY(_subject_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.grade_subject_ids_with_grades(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.grade_subject_ids_with_grades(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_subject_ids_with_grades(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.consolidate_grade_subject(_source uuid, _target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.grade_subjects;
  tgt public.grade_subjects;
  conflicts jsonb := '[]'::jsonb;
  filled integer := 0;
  removed integer := 0;
  moved integer := 0;
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _source = _target THEN
    RETURN jsonb_build_object('status', 'ok', 'conflicts', conflicts,
      'filled', 0, 'removed', 0, 'moved', 0);
  END IF;

  SELECT * INTO src FROM public.grade_subjects WHERE id = _source;
  SELECT * INTO tgt FROM public.grade_subjects WHERE id = _target;
  IF src.id IS NULL OR tgt.id IS NULL THEN
    RAISE EXCEPTION 'Disciplina de notas nao encontrada';
  END IF;
  IF src.class_id <> tgt.class_id THEN
    RAISE EXCEPTION 'Disciplinas de turmas diferentes nao podem ser consolidadas';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'student_id', x.student_id,
           'grade_period_id', x.grade_period_id,
           'source_value', x.source_value,
           'target_value', x.target_value)), '[]'::jsonb)
    INTO conflicts
    FROM (
      SELECT s.student_id, s.grade_period_id, s.value AS source_value, t.value AS target_value
        FROM public.student_grades s
        JOIN public.student_grades t
          ON t.grade_subject_id = _target
         AND t.student_id = s.student_id
         AND t.grade_period_id = s.grade_period_id
       WHERE s.grade_subject_id = _source
         AND s.value IS NOT NULL
         AND t.value IS NOT NULL
         AND s.value <> t.value
    ) x;

  IF jsonb_array_length(conflicts) > 0 THEN
    RETURN jsonb_build_object('status', 'conflict', 'conflicts', conflicts,
      'filled', 0, 'removed', 0, 'moved', 0);
  END IF;

  UPDATE public.student_grades t
     SET value = s.value,
         raw_text = s.raw_text,
         confidence = s.confidence,
         flags = s.flags,
         source = s.source,
         import_id = s.import_id
    FROM public.student_grades s
   WHERE t.grade_subject_id = _target
     AND s.grade_subject_id = _source
     AND t.student_id = s.student_id
     AND t.grade_period_id = s.grade_period_id
     AND t.value IS NULL
     AND s.value IS NOT NULL;
  GET DIAGNOSTICS filled = ROW_COUNT;

  DELETE FROM public.student_grades s
   WHERE s.grade_subject_id = _source
     AND EXISTS (
       SELECT 1 FROM public.student_grades t
        WHERE t.grade_subject_id = _target
          AND t.student_id = s.student_id
          AND t.grade_period_id = s.grade_period_id);
  GET DIAGNOSTICS removed = ROW_COUNT;

  UPDATE public.student_grades
     SET grade_subject_id = _target
   WHERE grade_subject_id = _source;
  GET DIAGNOSTICS moved = ROW_COUNT;

  UPDATE public.grade_subjects
     SET legacy_excluded = true, include_in_ira = false
   WHERE id = _source;

  RETURN jsonb_build_object('status', 'ok', 'conflicts', '[]'::jsonb,
    'filled', filled, 'removed', removed, 'moved', moved);
END;
$$;

REVOKE ALL ON FUNCTION public.consolidate_grade_subject(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.consolidate_grade_subject(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consolidate_grade_subject(uuid, uuid) TO service_role;