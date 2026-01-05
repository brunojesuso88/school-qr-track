-- 1. Criar função helper para verificar múltiplas roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(_roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role = ANY(_roles)
  )
$$;

-- 2. Atualizar políticas da tabela settings (adicionar direction)
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
CREATE POLICY "Admin and direction can view settings" ON settings
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

DROP POLICY IF EXISTS "Admins can update settings" ON settings;
CREATE POLICY "Admin and direction can update settings" ON settings
FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

DROP POLICY IF EXISTS "Admins can insert settings" ON settings;
CREATE POLICY "Only admin can insert settings" ON settings
FOR INSERT TO authenticated
WITH CHECK (current_user_has_role('admin'::app_role));

-- 3. Atualizar políticas de attendance (adicionar direction, restringir staff em DELETE)
DROP POLICY IF EXISTS "Staff can view attendance" ON attendance;
CREATE POLICY "Staff can view attendance" ON attendance
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can insert attendance" ON attendance;
CREATE POLICY "Staff can insert attendance" ON attendance
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update attendance" ON attendance;
CREATE POLICY "Staff can update attendance" ON attendance
FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can delete attendance" ON attendance;
CREATE POLICY "Admin direction and teachers can delete attendance" ON attendance
FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

-- 4. Atualizar políticas de classes (adicionar direction)
DROP POLICY IF EXISTS "Staff can view classes" ON classes;
CREATE POLICY "Staff can view classes" ON classes
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can insert classes" ON classes;
CREATE POLICY "Staff can insert classes" ON classes
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update classes" ON classes;
CREATE POLICY "Staff can update classes" ON classes
FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can delete classes" ON classes;
CREATE POLICY "Admin direction and teachers can delete classes" ON classes
FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

-- 5. Atualizar políticas de occurrences (adicionar direction, restringir staff)
DROP POLICY IF EXISTS "Staff can view occurrences" ON occurrences;
CREATE POLICY "Staff can view occurrences" ON occurrences
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can insert occurrences" ON occurrences;
CREATE POLICY "Staff can insert occurrences" ON occurrences
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update occurrences" ON occurrences;
CREATE POLICY "Staff can update occurrences" ON occurrences
FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

DROP POLICY IF EXISTS "Staff can delete occurrences" ON occurrences;
CREATE POLICY "Admin direction and teachers can delete occurrences" ON occurrences
FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

-- 6. Atualizar políticas de students (adicionar direction, restringir staff)
DROP POLICY IF EXISTS "Staff can view students" ON students;
CREATE POLICY "Staff can view students" ON students
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can insert students" ON students;
CREATE POLICY "Staff can insert students" ON students
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update students" ON students;
CREATE POLICY "Staff can update students" ON students
FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

DROP POLICY IF EXISTS "Staff can delete students" ON students;
CREATE POLICY "Admin direction and teachers can delete students" ON students
FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

-- 7. Atualizar políticas de notification_logs (adicionar direction)
DROP POLICY IF EXISTS "Admin-only notification logs select" ON notification_logs;
CREATE POLICY "Admin and direction can view notification logs" ON notification_logs
FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

DROP POLICY IF EXISTS "Admin-only notification logs insert" ON notification_logs;
CREATE POLICY "Admin and direction can insert notification logs" ON notification_logs
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- 8. Reforçar políticas de user_roles (apenas admin pode modificar)
CREATE POLICY "Only admins can insert roles" ON user_roles
FOR INSERT TO authenticated
WITH CHECK (current_user_has_role('admin'::app_role));

CREATE POLICY "Only admins can delete roles" ON user_roles
FOR DELETE TO authenticated
USING (current_user_has_role('admin'::app_role));