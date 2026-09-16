-- 1) Remove a policy legada ampla que permitia UPDATE a qualquer membro da escola.
DROP POLICY IF EXISTS school_isolation ON public.occurrences;

-- 2) Backfill da autoria histórica a partir do primeiro audit log de INSERT.
ALTER TABLE public.occurrences DISABLE TRIGGER occurrences_protect_immutable_trg;

UPDATE public.occurrences o
SET created_by = a.user_id
FROM (
  SELECT DISTINCT ON (record_id) record_id, user_id
  FROM public.audit_logs
  WHERE action = 'INSERT'
    AND table_name = 'occurrences'
    AND user_id IS NOT NULL
    AND record_id IS NOT NULL
  ORDER BY record_id, created_at ASC
) a
WHERE a.record_id = o.id
  AND o.created_by IS NULL;

ALTER TABLE public.occurrences ENABLE TRIGGER occurrences_protect_immutable_trg;