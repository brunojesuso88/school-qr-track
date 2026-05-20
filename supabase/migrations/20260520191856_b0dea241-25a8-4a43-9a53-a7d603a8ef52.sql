ALTER TABLE public.students ALTER COLUMN guardian_name DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN guardian_phone DROP NOT NULL;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_guardian_name_length;
ALTER TABLE public.students ADD CONSTRAINT students_guardian_name_length
  CHECK (guardian_name IS NULL OR (char_length(guardian_name) >= 3 AND char_length(guardian_name) <= 100));

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_guardian_phone_format;
ALTER TABLE public.students ADD CONSTRAINT students_guardian_phone_format
  CHECK (guardian_phone IS NULL OR guardian_phone = '' OR guardian_phone ~ '^\d{10,11}$');