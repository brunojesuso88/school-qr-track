CREATE TABLE public.daily_attendance_closures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name text NOT NULL,
  date date NOT NULL,
  shift text,
  student_count integer NOT NULL DEFAULT 0,
  present_count integer NOT NULL DEFAULT 0,
  absent_count integer NOT NULL DEFAULT 0,
  closed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX daily_attendance_closures_class_date_unique
  ON public.daily_attendance_closures (class_name, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_attendance_closures TO authenticated;
GRANT ALL ON public.daily_attendance_closures TO service_role;

ALTER TABLE public.daily_attendance_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view daily closures"
ON public.daily_attendance_closures
FOR SELECT
TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Teachers and management can create daily closures"
ON public.daily_attendance_closures
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Teachers and management can update daily closures"
ON public.daily_attendance_closures
FOR UPDATE
TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]))
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Management can delete daily closures"
ON public.daily_attendance_closures
FOR DELETE
TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE TRIGGER update_daily_attendance_closures_updated_at
BEFORE UPDATE ON public.daily_attendance_closures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();