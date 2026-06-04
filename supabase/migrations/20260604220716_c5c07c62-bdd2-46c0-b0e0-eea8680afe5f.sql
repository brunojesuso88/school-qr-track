
-- Table for management signatures
CREATE TABLE public.management_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_label text,
  storage_path text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.management_signatures TO authenticated;
GRANT ALL ON public.management_signatures TO service_role;

ALTER TABLE public.management_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Direction can view signatures"
  ON public.management_signatures FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can insert signatures"
  ON public.management_signatures FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can update signatures"
  ON public.management_signatures FOR UPDATE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can delete signatures"
  ON public.management_signatures FOR DELETE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE TRIGGER trg_management_signatures_updated_at
  BEFORE UPDATE ON public.management_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to enforce single default
CREATE OR REPLACE FUNCTION public.management_signatures_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.management_signatures
       SET is_default = false
     WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_management_signatures_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.management_signatures
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.management_signatures_single_default();

-- Storage policies for management-signatures bucket
CREATE POLICY "Admin and Direction can view signature files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can upload signature files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can update signature files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and Direction can delete signature files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'management-signatures' AND public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));
