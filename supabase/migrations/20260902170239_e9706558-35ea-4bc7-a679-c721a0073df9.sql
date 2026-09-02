CREATE OR REPLACE FUNCTION public.set_default_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int := 0;
  parent_table text;
  fk_column text;
  fk_value uuid;
  found_school uuid;
  membership_count int;
BEGIN
  IF NEW.school_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WHILE i < TG_NARGS LOOP
    parent_table := TG_ARGV[i];
    fk_column := TG_ARGV[i + 1];
    EXECUTE format('SELECT ($1).%I', fk_column) INTO fk_value USING NEW;
    IF fk_value IS NOT NULL THEN
      EXECUTE format('SELECT school_id FROM public.%I WHERE id = $1', parent_table)
        INTO found_school USING fk_value;
      IF found_school IS NOT NULL THEN
        NEW.school_id := found_school;
        RETURN NEW;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;

  SELECT count(*) INTO membership_count
    FROM public.school_memberships
   WHERE user_id = auth.uid() AND status = 'active';

  IF membership_count = 1 THEN
    SELECT school_id INTO found_school
      FROM public.school_memberships
     WHERE user_id = auth.uid() AND status = 'active'
     LIMIT 1;
    NEW.school_id := found_school;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Escola nao definida para este registro. Selecione a escola ativa antes de salvar.';
END
$$;