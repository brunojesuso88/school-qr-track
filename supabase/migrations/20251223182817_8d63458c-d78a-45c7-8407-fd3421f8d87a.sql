-- ==============================================
-- FIX 1: Create a safer function for checking current user's role
-- This prevents role enumeration attacks
-- ==============================================

-- Create a new safer function that only checks the current user's role
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Update has_role to only allow checking own role OR if caller is admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = _role
      AND (
        _user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
  )
$$;

-- Remove unused is_authenticated() function (dead code)
DROP FUNCTION IF EXISTS public.is_authenticated();

-- ==============================================
-- FIX 2: Restrict students table to staff roles only
-- Mobile users (role='user') should have limited access
-- ==============================================

DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

-- Staff (admin/teacher/staff) can fully manage students
CREATE POLICY "Staff can view students"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can delete students"
  ON public.students FOR DELETE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

-- ==============================================
-- FIX 3: Restrict attendance table to staff roles
-- ==============================================

DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated users can update attendance" ON public.attendance;

CREATE POLICY "Staff can view attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can insert attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can update attendance"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

-- ==============================================
-- FIX 4: Restrict occurrences table to staff roles
-- ==============================================

DROP POLICY IF EXISTS "Anyone can view occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Anyone can insert occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Anyone can update occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Anyone can delete occurrences" ON public.occurrences;

CREATE POLICY "Staff can view occurrences"
  ON public.occurrences FOR SELECT
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can insert occurrences"
  ON public.occurrences FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can update occurrences"
  ON public.occurrences FOR UPDATE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can delete occurrences"
  ON public.occurrences FOR DELETE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

-- ==============================================
-- FIX 5: Restrict classes table to staff roles
-- ==============================================

DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
DROP POLICY IF EXISTS "Anyone can insert classes" ON public.classes;
DROP POLICY IF EXISTS "Anyone can update classes" ON public.classes;
DROP POLICY IF EXISTS "Anyone can delete classes" ON public.classes;

CREATE POLICY "Staff can view classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can insert classes"
  ON public.classes FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can update classes"
  ON public.classes FOR UPDATE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

CREATE POLICY "Staff can delete classes"
  ON public.classes FOR DELETE
  TO authenticated
  USING (
    current_user_has_role('admin'::app_role) OR
    current_user_has_role('teacher'::app_role) OR
    current_user_has_role('staff'::app_role)
  );

-- ==============================================
-- FIX 6: Restrict settings table to admin only
-- ==============================================

DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.settings;

CREATE POLICY "Admins can view settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Admins can insert settings"
  ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (current_user_has_role('admin'::app_role));