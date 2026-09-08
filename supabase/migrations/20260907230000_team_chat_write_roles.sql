-- Align Team Chat write access with the CRM's read-only role semantics.
drop policy if exists "members can send messages to accessible channels"
on public.team_messages;

create policy "members can send messages to accessible channels"
on public.team_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
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
  and can_access_team_channel(channel_id)
  and exists (
    select 1
    from public.team_channels c
    where c.id = team_messages.channel_id
      and c.organization_id = team_messages.organization_id
  )
);
