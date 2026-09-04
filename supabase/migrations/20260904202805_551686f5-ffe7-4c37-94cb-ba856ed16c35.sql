REVOKE ALL ON FUNCTION public.seed_school_integral_matrix(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_school_integral_matrix(uuid) TO service_role;