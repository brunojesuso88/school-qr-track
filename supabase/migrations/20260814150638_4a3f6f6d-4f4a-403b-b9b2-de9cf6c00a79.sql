-- Remove a política ampla de UPDATE do staff em students
DROP POLICY IF EXISTS "Staff can update student photo only" ON public.students;

-- Função segura: staff (e demais papéis autorizados) atualizam apenas a foto
CREATE OR REPLACE FUNCTION public.update_student_photo(_student_id uuid, _photo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.students
     SET photo_url = _photo_url
   WHERE id = _student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_student_photo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_student_photo(uuid, text) TO authenticated;