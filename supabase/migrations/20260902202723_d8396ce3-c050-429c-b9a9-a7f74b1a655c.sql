-- 1) Papel efetivo NA ESCOLA DO REGISTRO (admin global sempre permitido)
CREATE OR REPLACE FUNCTION public.has_row_role(_school_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_global_admin()
     OR (
       _school_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.school_memberships m
          WHERE m.user_id = auth.uid()
            AND m.school_id = _school_id
            AND m.status = 'active'
            AND m.role = ANY(_roles)
       )
     )
$$;

-- 2) Reescreve as policies de papel das tabelas escolares para usar o school_id da linha
DO $do$
DECLARE
  r record;
  q text;
  w text;
  ddl text;
BEGIN
  FOR r IN
    SELECT tablename AS t, policyname AS n, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(user_has_any_role|current_user_has_role)\('
       AND tablename NOT IN ('audit_logs','cid_lookup_cache','profiles','user_roles')
  LOOP
    q := regexp_replace(
           regexp_replace(r.qual, 'current_user_has_role\(([^)]*)\)',
             'public.has_row_role(' || quote_ident(r.t) || '.school_id, ARRAY[\1])', 'g'),
           'user_has_any_role\(', 'public.has_row_role(' || quote_ident(r.t) || '.school_id, ', 'g');
    w := regexp_replace(
           regexp_replace(r.with_check, 'current_user_has_role\(([^)]*)\)',
             'public.has_row_role(' || quote_ident(r.t) || '.school_id, ARRAY[\1])', 'g'),
           'user_has_any_role\(', 'public.has_row_role(' || quote_ident(r.t) || '.school_id, ', 'g');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.n, r.t);
    ddl := format('CREATE POLICY %I ON public.%I FOR %s TO authenticated', r.n, r.t, r.cmd);
    IF q IS NOT NULL THEN ddl := ddl || ' USING (' || q || ')'; END IF;
    IF w IS NOT NULL THEN ddl := ddl || ' WITH CHECK (' || w || ')'; END IF;
    EXECUTE ddl;
  END LOOP;
END
$do$;

-- 3) Storage: exige caminho schools/<school_id>/... (sem fallback legado)
CREATE OR REPLACE FUNCTION public.storage_school_allowed(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.storage_path_school_id(_name) IS NOT NULL
     AND public.can_access_school(public.storage_path_school_id(_name))
$$;

-- 4) Storage: papel avaliado na escola do caminho do arquivo
DO $do$
DECLARE
  r record;
  q text;
  w text;
  ddl text;
  expr text := 'public.storage_path_school_id(name)';
BEGIN
  FOR r IN
    SELECT policyname AS n, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(user_has_any_role|current_user_has_role)\('
  LOOP
    q := regexp_replace(
           regexp_replace(r.qual, 'current_user_has_role\(([^)]*)\)',
             'public.has_row_role(' || expr || ', ARRAY[\1])', 'g'),
           'user_has_any_role\(', 'public.has_row_role(' || expr || ', ', 'g');
    w := regexp_replace(
           regexp_replace(r.with_check, 'current_user_has_role\(([^)]*)\)',
             'public.has_row_role(' || expr || ', ARRAY[\1])', 'g'),
           'user_has_any_role\(', 'public.has_row_role(' || expr || ', ', 'g');

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.n);
    ddl := format('CREATE POLICY %I ON storage.objects FOR %s TO authenticated', r.n, r.cmd);
    IF q IS NOT NULL THEN ddl := ddl || ' USING (' || q || ')'; END IF;
    IF w IS NOT NULL THEN ddl := ddl || ' WITH CHECK (' || w || ')'; END IF;
    EXECUTE ddl;
  END LOOP;
END
$do$;

-- 5) QR do aluno: único por escola
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_qr_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_qr_code_unique
  ON public.students (school_id, qr_code);