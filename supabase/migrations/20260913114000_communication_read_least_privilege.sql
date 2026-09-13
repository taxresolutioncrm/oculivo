-- Restrict patient communications reads to communication-capable practice roles.
-- This aligns SELECT visibility with the roles already permitted to send email/SMS/voice/fax.

drop policy if exists "members can view communication threads"
on public.communication_threads;

create policy "communication roles can view communication threads"
on public.communication_threads
for select
to authenticated
using (
  has_org_role(
    organization_id,
    array[
      'owner'::org_role,
      'admin'::org_role,
      'manager'::org_role,
      'provider'::org_role,
      'staff'::org_role
    ]
  )
);

drop policy if exists "members can view communication messages"
on public.communication_messages;

create policy "communication roles can view communication messages"
on public.communication_messages
for select
to authenticated
using (
  has_org_role(
    organization_id,
    array[
      'owner'::org_role,
      'admin'::org_role,
      'manager'::org_role,
      'provider'::org_role,
      'staff'::org_role
    ]
  )
);
