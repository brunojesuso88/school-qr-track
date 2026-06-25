
-- 1) mapping_teachers: re-create policies scoped to authenticated role
DROP POLICY IF EXISTS "Admin and direction can delete mapping_teachers" ON public.mapping_teachers;
DROP POLICY IF EXISTS "Admin and direction can insert mapping_teachers" ON public.mapping_teachers;
DROP POLICY IF EXISTS "Admin and direction can select mapping_teachers" ON public.mapping_teachers;
DROP POLICY IF EXISTS "Admin and direction can update mapping_teachers" ON public.mapping_teachers;

CREATE POLICY "Admin and direction can select mapping_teachers"
  ON public.mapping_teachers FOR SELECT TO authenticated
  USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can insert mapping_teachers"
  ON public.mapping_teachers FOR INSERT TO authenticated
  WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can update mapping_teachers"
  ON public.mapping_teachers FOR UPDATE TO authenticated
  USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can delete mapping_teachers"
  ON public.mapping_teachers FOR DELETE TO authenticated
  USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

-- 2) student-photos bucket: enforce path-based ownership on INSERT/UPDATE.
-- Upload filename pattern (see src/pages/Students.tsx): "<studentUuid>-<timestamp>.<ext>".
-- Require the first 36 chars to be the UUID of an existing student row.
DROP POLICY IF EXISTS "Staff can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update student photos" ON storage.objects;

CREATE POLICY "Staff can upload student photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role])
    AND length(name) >= 36
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id::text = left(name, 36)
    )
  );

CREATE POLICY "Staff can update student photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role])
    AND length(name) >= 36
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id::text = left(name, 36)
    )
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role])
    AND length(name) >= 36
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id::text = left(name, 36)
    )
  );
