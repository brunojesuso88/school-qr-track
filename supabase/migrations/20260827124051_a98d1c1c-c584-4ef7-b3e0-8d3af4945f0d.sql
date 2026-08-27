DROP INDEX IF EXISTS public.idx_smc_active_range;
DROP EXTENSION IF EXISTS btree_gist;

CREATE INDEX idx_smc_active_dates ON public.student_medical_certificates (start_date, end_date)
  WHERE status_manual = 'active';

REVOKE ALL ON FUNCTION public.prevent_certificate_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_certificate_overlap() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_certificate_overlap() FROM authenticated;
REVOKE ALL ON FUNCTION public.get_certificate_coverage(uuid[], date, date) FROM anon;
REVOKE ALL ON FUNCTION public.get_active_certificate_students(date) FROM anon;
