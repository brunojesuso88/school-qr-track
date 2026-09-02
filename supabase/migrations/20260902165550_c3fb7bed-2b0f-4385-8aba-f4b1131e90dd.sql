CREATE OR REPLACE FUNCTION public.default_school_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i int := 0;
  parent_table text;
  fk_column text;
  fk_value uuid;
  found_school uuid;
  membership_count int;
BEGIN
  IF NEW.school_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WHILE i < TG_NARGS LOOP
    parent_table := TG_ARGV[i];
    fk_column := TG_ARGV[i + 1];
    EXECUTE format('SELECT ($1).%I', fk_column) INTO fk_value USING NEW;
    IF fk_value IS NOT NULL THEN
      EXECUTE format('SELECT school_id FROM public.%I WHERE id = $1', parent_table)
        INTO found_school USING fk_value;
      IF found_school IS NOT NULL THEN
        NEW.school_id := found_school;
        RETURN NEW;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;

  SELECT count(*), min(school_id) INTO membership_count, found_school
    FROM public.school_memberships
   WHERE user_id = auth.uid() AND status = 'active';

  IF membership_count = 1 THEN
    NEW.school_id := found_school;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Escola nao definida para este registro. Selecione a escola ativa antes de salvar.';
END $$;
REVOKE ALL ON FUNCTION public.default_school_id() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('attendance', $a$'students','student_id'$a$),
    ('occurrences', $a$'students','student_id'$a$),
    ('student_medical_certificates', $a$'students','student_id'$a$),
    ('student_pei', $a$'students','student_id'$a$),
    ('student_paee', $a$'students','student_id'$a$),
    ('ira_snapshots', $a$'students','student_id'$a$),
    ('student_grades', $a$'grade_subjects','grade_subject_id','students','student_id'$a$),
    ('grade_subjects', $a$'classes','class_id'$a$),
    ('grade_periods', $a$'classes','class_id'$a$),
    ('grade_imports', $a$'classes','class_id'$a$),
    ('grade_import_sessions', $a$'classes','class_id'$a$),
    ('grade_import_jobs', $a$'classes','class_id'$a$),
    ('grade_import_session_pages', $a$'grade_import_sessions','session_id'$a$),
    ('ira_settings', $a$'classes','class_id'$a$),
    ('ira_staleness', $a$'classes','class_id'$a$),
    ('classes', $a$'mapping_classes','mapping_class_id'$a$),
    ('mapping_class_subjects', $a$'mapping_classes','class_id','mapping_teachers','teacher_id'$a$),
    ('teacher_availability', $a$'mapping_teachers','teacher_id'$a$),
    ('timetable_entries', $a$'mapping_classes','class_id'$a$),
    ('notification_logs', $a$'students','student_id'$a$),
    ('students', NULL),
    ('daily_attendance_closures', NULL),
    ('mapping_classes', NULL),
    ('mapping_teachers', NULL),
    ('timetable_settings', NULL),
    ('timetable_rules', NULL),
    ('timetable_generation_history', NULL),
    ('teacher_notifications', NULL),
    ('school_events', NULL),
    ('school_event_simple', NULL),
    ('management_signatures', NULL),
    ('settings', NULL)
  ) AS v(tbl, args) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_aa_default_school_id BEFORE INSERT ON public.%I FOR EACH ROW
         EXECUTE FUNCTION public.default_school_id(%s)',
      r.tbl, COALESCE(r.args, ''));
  END LOOP;
END $$;
