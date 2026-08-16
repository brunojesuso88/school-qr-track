ALTER TABLE public.grade_subjects
  ADD COLUMN IF NOT EXISTS legacy_excluded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS grade_subjects_class_active_idx
  ON public.grade_subjects (class_id) WHERE legacy_excluded = false;