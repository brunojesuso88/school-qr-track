-- 1) Histórico: nunca apagar fisicamente
DROP POLICY IF EXISTS "Admin and direction can delete certificates" ON public.student_medical_certificates;
REVOKE DELETE ON public.student_medical_certificates FROM authenticated;
REVOKE DELETE ON public.student_medical_certificates FROM anon;
GRANT ALL ON public.student_medical_certificates TO service_role;

-- 2) CID cache: apenas admin/direção
DROP POLICY IF EXISTS "Authenticated can read cid cache" ON public.cid_lookup_cache;
CREATE POLICY "Admin and direction can read cid cache"
ON public.cid_lookup_cache FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

-- 3) Cobertura com períodos: sem staff
CREATE OR REPLACE FUNCTION public.get_certificate_coverage(_student_ids uuid[], _start_date date, _end_date date)
RETURNS TABLE(student_id uuid, start_date date, end_date date, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.student_id, c.start_date, c.end_date, c.status_manual
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND c.student_id = ANY(_student_ids)
     AND daterange(c.start_date, c.end_date, '[]')
         && daterange(_start_date, _end_date, '[]')
     AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]);
$function$;

-- 4) Cobertura mínima (flags) para relatórios, inclusive staff
CREATE OR REPLACE FUNCTION public.get_certificate_coverage_flags(_student_ids uuid[], _dates date[])
RETURNS TABLE(student_id uuid, date date, covered boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.sid AS student_id, d.dt AS date, TRUE AS covered
    FROM unnest(_student_ids) AS s(sid)
    CROSS JOIN unnest(_dates) AS d(dt)
   WHERE public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
     AND EXISTS (
       SELECT 1 FROM public.student_medical_certificates c
        WHERE c.student_id = s.sid
          AND c.status_manual = 'active'
          AND d.dt BETWEEN c.start_date AND c.end_date
     );
$function$;

GRANT EXECUTE ON FUNCTION public.get_certificate_coverage_flags(uuid[], date[]) TO authenticated;

-- 5) Badges: apenas student_id
DROP FUNCTION IF EXISTS public.get_active_certificate_students(date);
CREATE FUNCTION public.get_active_certificate_students(_on_date date)
RETURNS TABLE(student_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT c.student_id
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND _on_date BETWEEN c.start_date AND c.end_date
     AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]);
$function$;

GRANT EXECUTE ON FUNCTION public.get_active_certificate_students(date) TO authenticated;
