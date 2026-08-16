-- Fase 3 do importador: catálogo canônico de disciplinas com séries padrão e aliases do boletim.
-- `series`: text[] com valores '1' | '2' | '3' (anos do Ensino Médio). Vazio = sem série definida.
-- `aliases`: text[] com nomes equivalentes como aparecem no boletim em PDF.
ALTER TABLE public.mapping_global_subjects
  ADD COLUMN IF NOT EXISTS series text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.mapping_global_subjects
  DROP CONSTRAINT IF EXISTS mapping_global_subjects_series_valid;
ALTER TABLE public.mapping_global_subjects
  ADD CONSTRAINT mapping_global_subjects_series_valid
  CHECK (series <@ ARRAY['1','2','3']::text[]);

-- Backfill de aliases: SOMENTE correspondências inequívocas observadas nos boletins.
UPDATE public.mapping_global_subjects
   SET aliases = ARRAY['LINGUA PORTUGUESA','LÍNGUA PORTUGUESA']
 WHERE lower(name) = 'português' AND aliases = '{}';

UPDATE public.mapping_global_subjects
   SET aliases = ARRAY['LINGUA INGLESA','LÍNGUA INGLESA']
 WHERE lower(name) = 'inglês' AND aliases = '{}';

-- Backfill de séries: uso real da disciplina (nome idêntico, sem acento/caixa) em turmas
-- que já possuem `classes.series` configurada. Sem evidência => permanece vazio.
WITH usage AS (
  SELECT DISTINCT
         lower(translate(mcs.subject_name,
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) AS norm,
         c.series AS serie
    FROM public.mapping_class_subjects mcs
    JOIN public.classes c ON c.mapping_class_id = mcs.class_id
   WHERE c.series IN ('1','2','3')
)
UPDATE public.mapping_global_subjects g
   SET series = sub.series_list
  FROM (
    SELECT norm, array_agg(DISTINCT serie ORDER BY serie) AS series_list
      FROM usage
     GROUP BY norm
  ) sub
 WHERE g.series = '{}'
   AND lower(translate(g.name,
         'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
         'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) = sub.norm;