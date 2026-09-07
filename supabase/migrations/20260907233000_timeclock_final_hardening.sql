-- Final Timeclock hardening: keep read-only users from writing and prevent concurrent duplicate open shifts.

drop policy if exists "users can insert their own time entries"
on public.time_entries;

create policy "users can insert their own time entries"
on public.time_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and has_org_role(
    organization_id,
    array[
      'owner'::org_role,
      'admin'::org_role,
      'manager'::org_role,
      'provider'::org_role,
      'staff'::org_role,
      'billing'::org_role
    ]
  )
);

drop policy if exists "users can update their own time entries"
on public.time_entries;

create policy "users can update their own time entries"
on public.time_entries
for update
to authenticated
using (
  (
    user_id = auth.uid()
    and has_org_role(
      organization_id,
      array[
        'owner'::org_role,
        'admin'::org_role,
        'manager'::org_role,
        'provider'::org_role,
        'staff'::org_role,
        'billing'::org_role
      ]
    )
  )
  or is_org_admin(organization_id)
)
with check (
  (
    user_id = auth.uid()
    and has_org_role(
      organization_id,
      array[
        'owner'::org_role,
        'admin'::org_role,
        'manager'::org_role,
        'provider'::org_role,
        'staff'::org_role,
        'billing'::org_role
      ]
    )
  )
  or is_org_admin(organization_id)
);

create unique index if not exists time_entries_one_open_shift_per_user_org
on public.time_entries (organization_id, user_id)
where clock_out is null;
