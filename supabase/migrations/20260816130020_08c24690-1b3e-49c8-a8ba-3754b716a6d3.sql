-- 1) Eventos: campos exclusivos do modelo simples no modelo canônico
ALTER TABLE public.school_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.school_events ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE public.school_events ADD COLUMN IF NOT EXISTS legacy_simple_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS school_events_legacy_simple_id_key
  ON public.school_events (legacy_simple_id) WHERE legacy_simple_id IS NOT NULL;

-- Backfill idempotente do modelo simples -> modelo canônico
INSERT INTO public.school_events (
  title, description, event_date, prazo_inicio, cover_image, images,
  tags, created_by, created_at, updated_at, legacy_simple_id
)
SELECT s.name, s.description, s.event_date, s.event_date, s.cover_image, s.images,
       ARRAY['evento']::text[], s.created_by, s.created_at, s.updated_at, s.id
FROM public.school_event_simple s
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_events e WHERE e.legacy_simple_id = s.id
);

-- 2) Turmas: vínculo canônico turma -> configuração de mapeamento (somente correspondência exata e única)
UPDATE public.classes c
SET mapping_class_id = m.id
FROM public.mapping_classes m
WHERE c.mapping_class_id IS NULL
  AND lower(trim(m.name)) = lower(trim(c.name))
  AND m.shift = c.shift
  AND NOT EXISTS (
    SELECT 1 FROM public.mapping_classes m2
    WHERE m2.id <> m.id
      AND lower(trim(m2.name)) = lower(trim(c.name))
      AND m2.shift = c.shift
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.classes c2 WHERE c2.mapping_class_id = m.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS classes_mapping_class_id_key
  ON public.classes (mapping_class_id) WHERE mapping_class_id IS NOT NULL;