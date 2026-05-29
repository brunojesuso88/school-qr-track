
CREATE TABLE public.teacher_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number integer NOT NULL,
  doc_year integer NOT NULL,
  teacher_name text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('stage_1','stage_2')),
  reason text NOT NULL,
  obligations text[] NOT NULL DEFAULT '{}',
  other_obligation text,
  original_deadline date NOT NULL,
  new_deadline date NOT NULL,
  classes_subjects text,
  teacher_justification text,
  custom_body text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_year, doc_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_notifications TO authenticated;
GRANT ALL ON public.teacher_notifications TO service_role;

ALTER TABLE public.teacher_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin direction can view teacher_notifications"
ON public.teacher_notifications FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE POLICY "Admin direction can insert teacher_notifications"
ON public.teacher_notifications FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE POLICY "Admin direction can update teacher_notifications"
ON public.teacher_notifications FOR UPDATE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE POLICY "Admin direction can delete teacher_notifications"
ON public.teacher_notifications FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE TRIGGER trg_teacher_notifications_updated_at
BEFORE UPDATE ON public.teacher_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_teacher_notification_number(_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT COALESCE(MAX(doc_number), 0) + 1
    INTO next_num
    FROM public.teacher_notifications
   WHERE doc_year = _year;
  RETURN next_num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_teacher_notification_number(integer) TO authenticated;
