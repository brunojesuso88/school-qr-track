DO $$
DECLARE
  f text;
  trigger_fns text[] := ARRAY[
    'enforce_child_school_match()',
    'enforce_school_id_immutable()',
    'handle_new_user()',
    'log_audit_event()',
    'management_signatures_single_default()',
    'prevent_certificate_overlap()',
    'restrict_class_series_updates()',
    'restrict_report_card_fields()',
    'restrict_staff_student_updates()',
    'update_updated_at_column()',
    'validate_attendance_weekday()'
  ];
  anon_revoke_fns text[] := ARRAY[
    'is_global_admin()',
    'is_school_member(uuid)',
    'has_school_role(uuid, app_role[])',
    'can_access_school(uuid)',
    'current_user_school_ids()',
    'user_has_any_role(app_role[])',
    'current_user_has_role(app_role)',
    'has_role(uuid, app_role)',
    'join_school_with_token(text)',
    'admin_create_school(text, text, text, text)',
    'admin_regenerate_registration_link(uuid)',
    'admin_revoke_registration_link(uuid)',
    'admin_upsert_membership(uuid, uuid, app_role, text)',
    'admin_remove_membership(uuid, uuid)',
    'admin_list_users()',
    'admin_school_overview()',
    'admin_school_members(uuid)',
    'consolidate_grade_subject(uuid, uuid)',
    'get_student_basic_by_qr(text)',
    'grade_subject_ids_with_grades(uuid[])',
    'next_teacher_notification_number(integer)',
    'update_student_photo(uuid, text)'
  ];
BEGIN
  FOREACH f IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY anon_revoke_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
