REVOKE EXECUTE ON FUNCTION public.get_certificate_coverage_flags(uuid[], date[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_certificate_students(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_certificate_coverage(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_certificate_coverage(uuid[], date, date) TO authenticated;
