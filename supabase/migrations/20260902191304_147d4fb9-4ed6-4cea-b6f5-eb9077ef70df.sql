-- 1) STORAGE: remover bypass de policies sem guarda escolar
DROP POLICY IF EXISTS "Staff can view class photos" ON storage.objects;
CREATE POLICY "Staff can view class photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'class-photos'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff can view student photos" ON storage.objects;
CREATE POLICY "Staff can view student photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-photos'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff can delete own class photos" ON storage.objects;
CREATE POLICY "Staff can delete own class photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'class-photos'
  AND current_user_has_role('staff'::app_role)
  AND owner = auth.uid()
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff view school-events files" ON storage.objects;
CREATE POLICY "Staff view school-events files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'school-events'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff insert school-events files" ON storage.objects;
CREATE POLICY "Staff insert school-events files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-events'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff update school-events files" ON storage.objects;
CREATE POLICY "Staff update school-events files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'school-events'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Staff delete school-events files" ON storage.objects;
CREATE POLICY "Staff delete school-events files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-events'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role])
  AND storage_school_allowed(name)
);

DROP POLICY IF EXISTS "Teachers can upload medical certificates files" ON storage.objects;
CREATE POLICY "Teachers can upload medical certificates files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-certificates'
  AND current_user_has_role('teacher'::app_role)
  AND storage_school_allowed(name)
);

-- 2) PUSH: um mesmo device pode pertencer a mais de uma escola do mesmo usuario
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;
DROP INDEX IF EXISTS public.push_subscriptions_endpoint_key;
DROP INDEX IF EXISTS public.push_subscriptions_user_id_endpoint_key;

ALTER TABLE public.push_subscriptions ALTER COLUMN school_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_school_key
  ON public.push_subscriptions (user_id, endpoint, school_id);

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own subscriptions"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_school_member(school_id));

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND is_school_member(school_id));