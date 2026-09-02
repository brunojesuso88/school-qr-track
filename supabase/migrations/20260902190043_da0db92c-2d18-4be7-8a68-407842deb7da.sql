-- Escola "dona" dos arquivos legados (única escola existente no momento da migração
-- multi-escola). Caminhos legados NUNCA devem ser visíveis a outras escolas.
CREATE OR REPLACE FUNCTION public.legacy_storage_school_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '9e0c15ed-6dba-4d9e-88b0-a1edb68b82ec'::uuid;
$$;

REVOKE ALL ON FUNCTION public.legacy_storage_school_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legacy_storage_school_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.storage_school_allowed(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.storage_path_school_id(_name) IS NULL
      THEN public.can_access_school(public.legacy_storage_school_id())
    ELSE public.can_access_school(public.storage_path_school_id(_name))
  END;
$$;

REVOKE ALL ON FUNCTION public.storage_school_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_school_allowed(text) TO authenticated, service_role;