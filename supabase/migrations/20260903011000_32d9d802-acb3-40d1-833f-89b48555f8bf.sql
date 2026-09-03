ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_recorded_by_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_created_by_fkey;
ALTER TABLE public.students ADD CONSTRAINT students_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;