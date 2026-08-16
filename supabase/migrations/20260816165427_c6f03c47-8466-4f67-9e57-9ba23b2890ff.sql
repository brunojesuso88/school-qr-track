UPDATE public.curriculum_matrix_subjects cms
SET weekly_classes = 1, updated_at = now()
FROM public.mapping_global_subjects mgs
WHERE cms.subject_id = mgs.id
  AND cms.series = '1'
  AND public.normalize_subject_key(mgs.name) = public.normalize_subject_key('EDUCACAO FISICA')
  AND cms.weekly_classes <> 1;