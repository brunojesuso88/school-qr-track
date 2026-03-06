
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('class-photos', 'class-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can upload class photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'class-photos' AND
  public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can view class photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'class-photos' AND
  public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can update class photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'class-photos' AND
  public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can delete class photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-photos' AND
  public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);
