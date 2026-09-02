CREATE OR REPLACE FUNCTION public.get_student_basic_by_qr(_qr_code text)
RETURNS TABLE(id uuid, full_name text, student_id text, class text, shift text, photo_url text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT s.id, s.full_name, s.student_id, s.class, s.shift, s.photo_url, s.status::text
  FROM public.students s
  WHERE s.qr_code = _qr_code
    AND public.has_row_role(s.school_id, ARRAY['admin','direction','teacher','staff']::app_role[])
  LIMIT 1;
$function$;