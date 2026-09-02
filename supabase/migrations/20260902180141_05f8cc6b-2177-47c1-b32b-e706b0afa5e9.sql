-- ============ 1) Catálogo de disciplinas e matriz curricular por escola ============
ALTER TABLE public.mapping_global_subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.curriculum_matrix_subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

UPDATE public.mapping_global_subjects s
   SET school_id = (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
 WHERE s.school_id IS NULL;

UPDATE public.curriculum_matrix_subjects c
   SET school_id = COALESCE(
     (SELECT g.school_id FROM public.mapping_global_subjects g WHERE g.id = c.subject_id),
     (SELECT id FROM public.schools ORDER BY created_at LIMIT 1))
 WHERE c.school_id IS NULL;

CREATE INDEX IF NOT EXISTS mapping_global_subjects_school_id_idx ON public.mapping_global_subjects(school_id);
CREATE INDEX IF NOT EXISTS curriculum_matrix_subjects_school_id_idx ON public.curriculum_matrix_subjects(school_id);

DROP TRIGGER IF EXISTS trg_default_school_id ON public.mapping_global_subjects;
CREATE TRIGGER trg_default_school_id BEFORE INSERT ON public.mapping_global_subjects
  FOR EACH ROW EXECUTE FUNCTION public.default_school_id();

DROP TRIGGER IF EXISTS trg_default_school_id ON public.curriculum_matrix_subjects;
CREATE TRIGGER trg_default_school_id BEFORE INSERT ON public.curriculum_matrix_subjects
  FOR EACH ROW EXECUTE FUNCTION public.default_school_id('mapping_global_subjects', 'subject_id');

DROP TRIGGER IF EXISTS trg_school_id_immutable ON public.mapping_global_subjects;
CREATE TRIGGER trg_school_id_immutable BEFORE UPDATE ON public.mapping_global_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_school_id_immutable();

DROP TRIGGER IF EXISTS trg_school_id_immutable ON public.curriculum_matrix_subjects;
CREATE TRIGGER trg_school_id_immutable BEFORE UPDATE ON public.curriculum_matrix_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_school_id_immutable();

-- Políticas: substituir role-only por escopo de escola
DROP POLICY IF EXISTS "Admin and direction can select mapping_global_subjects" ON public.mapping_global_subjects;
DROP POLICY IF EXISTS "Admin and direction can insert mapping_global_subjects" ON public.mapping_global_subjects;
DROP POLICY IF EXISTS "Admin and direction can update mapping_global_subjects" ON public.mapping_global_subjects;
DROP POLICY IF EXISTS "Admin and direction can delete mapping_global_subjects" ON public.mapping_global_subjects;

CREATE POLICY "School members read subjects catalog"
  ON public.mapping_global_subjects FOR SELECT TO authenticated
  USING (public.can_access_school(school_id));

CREATE POLICY "School management manages subjects catalog"
  ON public.mapping_global_subjects FOR ALL TO authenticated
  USING (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]));

DROP POLICY IF EXISTS "Authenticated can read curriculum matrix" ON public.curriculum_matrix_subjects;
DROP POLICY IF EXISTS "Admin and direction manage curriculum matrix" ON public.curriculum_matrix_subjects;

CREATE POLICY "School members read curriculum matrix"
  ON public.curriculum_matrix_subjects FOR SELECT TO authenticated
  USING (public.can_access_school(school_id));

CREATE POLICY "School management manages curriculum matrix"
  ON public.curriculum_matrix_subjects FOR ALL TO authenticated
  USING (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]));

-- unicidade por escola
ALTER TABLE public.curriculum_matrix_subjects
  DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_subject_id_series_key;
DROP INDEX IF EXISTS public.curriculum_matrix_subjects_subject_id_series_key;
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_matrix_school_subject_series_unique
  ON public.curriculum_matrix_subjects(school_id, subject_id, series);

-- ============ 2) Notificações restritas à escola ============
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "School admins view school subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR (school_id IS NOT NULL AND public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]))
  );

DROP POLICY IF EXISTS "Management reads deliveries" ON public.notification_deliveries;
CREATE POLICY "School management reads deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.id = notification_deliveries.notification_id
         AND n.school_id IS NOT NULL
         AND public.has_school_role(n.school_id, ARRAY['admin','direction']::app_role[])
    )
  );

-- ============ 3) Índice duplicado de frequência ============
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
DROP INDEX IF EXISTS public.attendance_student_id_date_key;