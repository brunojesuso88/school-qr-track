-- Extrai o school_id de caminhos do tipo schools/<uuid>/...
CREATE OR REPLACE FUNCTION public.storage_path_school_id(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  seg text;
BEGIN
  IF _name IS NULL OR _name NOT LIKE 'schools/%' THEN
    RETURN NULL;
  END IF;
  seg := split_part(_name, '/', 2);
  IF seg !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN seg::uuid;
END
$$;

REVOKE ALL ON FUNCTION public.storage_path_school_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_path_school_id(text) TO authenticated, service_role;

-- Guarda de escola: caminho legado (sem pasta de escola) mantém comportamento anterior
CREATE OR REPLACE FUNCTION public.storage_school_allowed(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.storage_path_school_id(_name) IS NULL
      OR public.can_access_school(public.storage_path_school_id(_name));
$$;

REVOKE ALL ON FUNCTION public.storage_school_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_school_allowed(text) TO authenticated, service_role;

-- ============ management-signatures ============
DROP POLICY IF EXISTS "Admin and Direction can view signature files" ON storage.objects;
CREATE POLICY "Admin and Direction can view signature files" ON storage.objects FOR SELECT
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin and Direction can upload signature files" ON storage.objects;
CREATE POLICY "Admin and Direction can upload signature files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
              AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin and Direction can update signature files" ON storage.objects;
CREATE POLICY "Admin and Direction can update signature files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin and Direction can delete signature files" ON storage.objects;
CREATE POLICY "Admin and Direction can delete signature files" ON storage.objects FOR DELETE
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

-- ============ medical-certificates ============
DROP POLICY IF EXISTS "Admin direction can read medical certificates files" ON storage.objects;
CREATE POLICY "Admin direction can read medical certificates files" ON storage.objects FOR SELECT
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin direction can upload medical certificates files" ON storage.objects;
CREATE POLICY "Admin direction can upload medical certificates files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
              AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin direction can update medical certificates files" ON storage.objects;
CREATE POLICY "Admin direction can update medical certificates files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin direction can delete medical certificates files" ON storage.objects;
CREATE POLICY "Admin direction can delete medical certificates files" ON storage.objects FOR DELETE
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[])
         AND public.storage_school_allowed(name));

-- ============ aee-documents ============
DROP POLICY IF EXISTS "Admin direction teachers view AEE documents" ON storage.objects;
CREATE POLICY "Admin direction teachers view AEE documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'aee-documents' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin/Direction/Teachers can upload AEE documents" ON storage.objects;
CREATE POLICY "Admin/Direction/Teachers can upload AEE documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'aee-documents' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
              AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin/Direction/Teachers can update AEE documents" ON storage.objects;
CREATE POLICY "Admin/Direction/Teachers can update AEE documents" ON storage.objects FOR UPDATE
  USING (bucket_id = 'aee-documents' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Admin/Direction/Teachers can delete AEE documents" ON storage.objects;
CREATE POLICY "Admin/Direction/Teachers can delete AEE documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'aee-documents' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
         AND public.storage_school_allowed(name));

-- ============ class-photos ============
DROP POLICY IF EXISTS "Staff can upload class photos" ON storage.objects;
CREATE POLICY "Staff can upload class photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'class-photos' AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
              AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Staff can update class photos" ON storage.objects;
CREATE POLICY "Staff can update class photos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'class-photos' AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
         AND public.storage_school_allowed(name));

DROP POLICY IF EXISTS "Privileged roles can delete class photos" ON storage.objects;
CREATE POLICY "Privileged roles can delete class photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'class-photos' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
         AND public.storage_school_allowed(name));

-- ============ student-photos (valida uuid do aluno no nome do arquivo) ============
DROP POLICY IF EXISTS "Staff can upload student photos" ON storage.objects;
CREATE POLICY "Staff can upload student photos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-photos'
    AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
    AND public.storage_school_allowed(name)
    AND length(storage.filename(name)) >= 36
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id::text = "left"(storage.filename(name), 36))
  );

DROP POLICY IF EXISTS "Staff can update student photos" ON storage.objects;
CREATE POLICY "Staff can update student photos" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-photos'
    AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
    AND public.storage_school_allowed(name)
    AND length(storage.filename(name)) >= 36
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id::text = "left"(storage.filename(name), 36))
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
    AND public.storage_school_allowed(name)
    AND length(storage.filename(name)) >= 36
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id::text = "left"(storage.filename(name), 36))
  );

DROP POLICY IF EXISTS "Staff can delete student photos" ON storage.objects;
CREATE POLICY "Staff can delete student photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'student-photos' AND public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
         AND public.storage_school_allowed(name));