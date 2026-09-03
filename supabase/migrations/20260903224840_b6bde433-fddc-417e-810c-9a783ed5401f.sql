CREATE OR REPLACE FUNCTION public.get_school_preferences(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF _school_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT public.can_access_school(_school_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta escola';
  END IF;

  SELECT coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
    INTO _result
  FROM public.settings s
  WHERE s.school_id = _school_id
    AND s.key IN ('academic_year', 'current_bimester', 'show_inactive_students', 'default_student_sort');

  RETURN coalesce(_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_school_preferences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_preferences(uuid) TO authenticated;