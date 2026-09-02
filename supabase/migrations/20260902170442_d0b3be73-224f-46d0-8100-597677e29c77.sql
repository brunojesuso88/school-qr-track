DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND a.attname = 'school_id'
       AND a.attnotnull
       AND NOT a.attisdropped
       AND c.relname NOT IN ('schools','school_memberships','school_registration_links')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id DROP NOT NULL', r.tbl);
  END LOOP;
END $$;