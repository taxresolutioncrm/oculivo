-- Harden time entry RLS so a user's own row must still belong to an organization they are a member of.

drop policy if exists "users can manage their time entries"
on public.time_entries;

drop policy if exists "users can view their time entries"
on public.time_entries;

create policy "users can view their time entries"
on public.time_entries
for select
to authenticated
using (
  (
    user_id = auth.uid()
    and is_org_member(organization_id)
  )
  or is_org_admin(organization_id)
);

create policy "users can insert their own time entries"
on public.time_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and is_org_member(organization_id)
);

create policy "users can update their own time entries"
on public.time_entries
for update
to authenticated
using (
  (
    user_id = auth.uid()
    and is_org_member(organization_id)
  )
  or is_org_admin(organization_id)
)
with check (
  (
    user_id = auth.uid()
    and is_org_member(organization_id)
  )
  or is_org_admin(organization_id)
);

create policy "admins can delete time entries"
on public.time_entries
for delete
to authenticated
using (
  is_org_admin(organization_id)
);
