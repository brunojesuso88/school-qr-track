CREATE TABLE public.school_event_simple (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE,
  description TEXT DEFAULT '',
  cover_image TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.school_event_simple ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin direction teachers insert school_event_simple"
ON public.school_event_simple FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]));

CREATE POLICY "Admin direction teachers update school_event_simple"
ON public.school_event_simple FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]));

CREATE POLICY "Admin direction teachers delete school_event_simple"
ON public.school_event_simple FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]));

CREATE POLICY "Staff can view school_event_simple"
ON public.school_event_simple FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role]));

CREATE TRIGGER update_school_event_simple_updated_at
BEFORE UPDATE ON public.school_event_simple
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();