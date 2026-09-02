-- 1) notification_preferences por escola
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_event_type_key;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

INSERT INTO public.notification_preferences
  (user_id, event_type, push_enabled, inapp_enabled, quiet_hours_start, quiet_hours_end, school_id)
SELECT p.user_id, p.event_type, p.push_enabled, p.inapp_enabled,
       p.quiet_hours_start, p.quiet_hours_end, m.school_id
  FROM public.notification_preferences p
  JOIN public.school_memberships m
    ON m.user_id = p.user_id AND m.status = 'active'
 WHERE p.school_id IS NULL;

DELETE FROM public.notification_preferences WHERE school_id IS NULL;

ALTER TABLE public.notification_preferences ALTER COLUMN school_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_school_event_key
  ON public.notification_preferences (user_id, school_id, event_type);

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() AND (public.is_global_admin() OR public.is_school_member(school_id)))
  WITH CHECK (user_id = auth.uid() AND (public.is_global_admin() OR public.is_school_member(school_id)));

-- 2) Atestados: papel na escola da linha
CREATE OR REPLACE FUNCTION public.get_active_certificate_students(_on_date date)
 RETURNS TABLE(student_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT c.student_id
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND _on_date BETWEEN c.start_date AND c.end_date
     AND public.has_row_role(c.school_id, ARRAY['admin','direction','teacher','staff']::app_role[]);
$function$;

CREATE OR REPLACE FUNCTION public.get_certificate_coverage(_student_ids uuid[], _start_date date, _end_date date)
 RETURNS TABLE(student_id uuid, start_date date, end_date date, status text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.student_id, c.start_date, c.end_date, c.status_manual
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND c.student_id = ANY(_student_ids)
     AND daterange(c.start_date, c.end_date, '[]')
         && daterange(_start_date, _end_date, '[]')
     AND public.has_row_role(c.school_id, ARRAY['admin','direction','teacher']::app_role[]);
$function$;

CREATE OR REPLACE FUNCTION public.get_certificate_coverage_flags(_student_ids uuid[], _dates date[])
 RETURNS TABLE(student_id uuid, date date, covered boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.sid AS student_id, d.dt AS date, TRUE AS covered
    FROM unnest(_student_ids) AS s(sid)
    CROSS JOIN unnest(_dates) AS d(dt)
   WHERE EXISTS (
       SELECT 1 FROM public.student_medical_certificates c
        WHERE c.student_id = s.sid
          AND c.status_manual = 'active'
          AND d.dt BETWEEN c.start_date AND c.end_date
          AND public.has_row_role(c.school_id, ARRAY['admin','direction','teacher','staff']::app_role[])
     );
$function$;

-- 3) Foto do aluno: papel na escola do aluno
CREATE OR REPLACE FUNCTION public.update_student_photo(_student_id uuid, _photo_url text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _school uuid;
BEGIN
  SELECT school_id INTO _school FROM public.students WHERE id = _student_id;
  IF _school IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;
  IF NOT public.has_row_role(_school, ARRAY['admin','direction','teacher','staff']::app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.students
     SET photo_url = _photo_url
   WHERE id = _student_id AND school_id = _school;
END;
$function$;

-- 4) Numeração de notificação docente por escola
DROP FUNCTION IF EXISTS public.next_teacher_notification_number(integer);
CREATE OR REPLACE FUNCTION public.next_teacher_notification_number(_year integer, _school_id uuid)
 RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF _school_id IS NULL THEN
    RAISE EXCEPTION 'Escola não informada';
  END IF;
  IF NOT public.has_row_role(_school_id, ARRAY['admin'::app_role,'direction'::app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT COALESCE(MAX(doc_number), 0) + 1
    INTO next_num
    FROM public.teacher_notifications
   WHERE doc_year = _year AND school_id = _school_id;
  RETURN next_num;
END;
$function$;

-- 5) Triggers de restrição: papel na escola da linha
CREATE OR REPLACE FUNCTION public.restrict_class_series_updates()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.series IS DISTINCT FROM OLD.series
     AND NOT public.has_row_role(NEW.school_id, ARRAY['admin'::app_role,'direction'::app_role]) THEN
    RAISE EXCEPTION 'Apenas administração e direção podem alterar a série da turma';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restrict_report_card_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_row_role(NEW.school_id, ARRAY['admin'::app_role,'direction'::app_role]) THEN
    IF NEW.school_code IS DISTINCT FROM OLD.school_code
       OR NEW.mother_name IS DISTINCT FROM OLD.mother_name
       OR NEW.father_name IS DISTINCT FROM OLD.father_name
       OR NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
      RAISE EXCEPTION 'Apenas administração e direção podem alterar Código, filiação e data de nascimento';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restrict_staff_student_updates()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_row_role(NEW.school_id, ARRAY['staff'::app_role])
     AND NOT public.has_row_role(NEW.school_id, ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]) THEN
    IF to_jsonb(NEW) - 'photo_url' - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'photo_url' - 'updated_at' THEN
      RAISE EXCEPTION 'Staff podem atualizar apenas a foto do aluno';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;