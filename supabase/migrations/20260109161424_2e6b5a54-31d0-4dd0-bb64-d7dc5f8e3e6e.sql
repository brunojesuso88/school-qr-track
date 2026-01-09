-- ================================================
-- SECURITY IMPROVEMENTS MIGRATION
-- ================================================

-- 1. Remove duplicated 'role' column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 2. Create audit_logs table for security tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
CREATE POLICY "Only admin can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (current_user_has_role('admin'::app_role));

-- Only authenticated users can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. Update occurrences RLS - restrict staff from viewing
DROP POLICY IF EXISTS "Staff can view occurrences" ON public.occurrences;

CREATE POLICY "Admin direction and teachers can view occurrences" ON public.occurrences
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

-- 4. Create audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_students_trigger ON public.students;
CREATE TRIGGER audit_students_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_occurrences_trigger ON public.occurrences;
CREATE TRIGGER audit_occurrences_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.occurrences
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
CREATE TRIGGER audit_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();