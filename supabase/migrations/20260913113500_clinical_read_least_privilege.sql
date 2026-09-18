-- Restrict clinical-record reads to clinical leadership/provider roles.
-- Organization RLS remains the tenant boundary; this additionally removes clinical note visibility
-- from staff/billing members that do not require it for their role.

drop policy if exists "members can view clinical records"
on public.clinical_records;

create policy "clinical roles can view clinical records"
on public.clinical_records
for select
to authenticated
using (
  has_org_role(
    organization_id,
    array[
      'owner'::org_role,
      'admin'::org_role,
      'manager'::org_role,
      'provider'::org_role
    ]
  )
);
