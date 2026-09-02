DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendance','students','classes','occurrences','student_grades','grade_subjects',
    'grade_periods','ira_settings','ira_snapshots','ira_staleness','daily_attendance_closures',
    'notification_logs','settings','school_events','school_event_simple',
    'student_medical_certificates','student_pei','student_paee','mapping_classes',
    'mapping_teachers','mapping_class_subjects','mapping_global_subjects',
    'curriculum_matrix_subjects','timetable_entries','timetable_settings','timetable_rules',
    'teacher_availability','teacher_notifications','management_signatures','grade_imports',
    'grade_import_jobs','grade_import_sessions','grade_import_session_pages',
    'timetable_generation_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET NOT NULL', t);
  END LOOP;
END
$$;