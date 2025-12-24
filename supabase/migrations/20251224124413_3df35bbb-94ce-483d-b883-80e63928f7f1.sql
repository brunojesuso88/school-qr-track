-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Create new permissive policies for profiles
CREATE POLICY "Users can view own profile or admins can view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR current_user_has_role('admin'::app_role)
);

-- Create new permissive policies for user_roles
CREATE POLICY "Users can view own roles or admins can view all"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR current_user_has_role('admin'::app_role)
);

-- Add UPDATE policy for user_roles so admins can change roles
CREATE POLICY "Admins can update all roles"
ON public.user_roles
FOR UPDATE
USING (current_user_has_role('admin'::app_role));