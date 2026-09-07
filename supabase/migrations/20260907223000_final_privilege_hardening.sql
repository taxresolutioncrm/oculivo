-- Final Oculivo privilege hardening verified during closeout.

-- Billing RPCs: authenticated/service roles only; no anonymous or PUBLIC execution.
revoke execute
on function public.oculivo_create_invoice(uuid, uuid, text, numeric, date, jsonb)
from anon;

revoke execute
on function public.oculivo_create_invoice(uuid, uuid, text, numeric, date, jsonb)
from public;

revoke execute
on function public.oculivo_record_payment(uuid, uuid, uuid, numeric, text, text)
from anon;

revoke execute
on function public.oculivo_record_payment(uuid, uuid, uuid, numeric, text, text)
from public;

-- Narrow authenticated table grants to the operations actually allowed by policy.
revoke update, delete on table public.ai_activity_log from authenticated;
revoke insert, update, delete on table public.audit_log from authenticated;
revoke insert, delete on table public.organizations from authenticated;
revoke insert, delete on table public.profiles from authenticated;
revoke delete on table public.support_tickets from authenticated;
revoke update, delete on table public.team_messages from authenticated;
