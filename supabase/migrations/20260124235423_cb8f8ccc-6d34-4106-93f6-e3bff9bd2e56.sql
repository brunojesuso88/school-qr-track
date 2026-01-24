-- Novos campos para Sistema AEE
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS aee_cid_code TEXT,
ADD COLUMN IF NOT EXISTS aee_cid_description TEXT,
ADD COLUMN IF NOT EXISTS aee_uses_medication BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aee_medication_name TEXT,
ADD COLUMN IF NOT EXISTS aee_literacy_status TEXT DEFAULT 'no',
ADD COLUMN IF NOT EXISTS aee_adapted_activities BOOLEAN DEFAULT FALSE;

-- Adicionar constraint para literacy_status (apenas se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_aee_literacy_status_check'
  ) THEN
    ALTER TABLE public.students
    ADD CONSTRAINT students_aee_literacy_status_check 
    CHECK (aee_literacy_status IS NULL OR aee_literacy_status IN ('no', 'yes', 'in_process'));
  END IF;
END $$;