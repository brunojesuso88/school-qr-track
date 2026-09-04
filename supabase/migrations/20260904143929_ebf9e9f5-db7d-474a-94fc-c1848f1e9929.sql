drop policy if exists "Gestao da escola gerencia vinculos" on public.school_memberships;

create policy "Gestao da escola gerencia vinculos"
on public.school_memberships
for update
to authenticated
using (
  has_school_role(school_id, ARRAY['admin'::app_role, 'direction'::app_role])
  and user_id <> auth.uid()
)
with check (
  has_school_role(school_id, ARRAY['admin'::app_role, 'direction'::app_role])
  and user_id <> auth.uid()
  and (
    role <> 'admin'::app_role
    or has_school_role(school_id, ARRAY['admin'::app_role])
  )
);