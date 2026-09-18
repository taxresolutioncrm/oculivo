begin;

alter table public.communication_messages
  add column if not exists provider_message_id text;

create table if not exists public.communication_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('email','sms','voice','fax')),
  address text not null,
  is_primary boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind, address)
);

alter table public.communication_endpoints enable row level security;

create unique index if not exists communication_endpoints_one_primary_per_kind
  on public.communication_endpoints (organization_id, kind)
  where is_primary and is_active;

create index if not exists communication_endpoints_address_lookup
  on public.communication_endpoints (kind, lower(address))
  where is_active;


alter table public.communication_threads
  add column if not exists patient_id uuid references public.patients(id) on delete set null;

create index if not exists communication_threads_org_patient_idx
  on public.communication_threads (organization_id, patient_id)
  where patient_id is not null;

create or replace function public.oculivo_validate_communication_patient()
returns trigger
language plpgsql
set search_path = public
as $
begin
  if new.patient_id is not null and not exists (
    select 1
    from public.patients p
    where p.id = new.patient_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Communication patient must belong to the same practice'
      using errcode = '23514';
  end if;
  return new;
end;
$;

drop trigger if exists communication_threads_patient_scope on public.communication_threads;
create trigger communication_threads_patient_scope
before insert or update of patient_id, organization_id on public.communication_threads
for each row execute function public.oculivo_validate_communication_patient();

update public.communication_threads t
set patient_id = p.id
from public.patients p
where t.patient_id is null
  and p.organization_id = t.organization_id
  and (
    (t.email_address is not null and p.email is not null and lower(p.email) = lower(t.email_address))
    or
    (t.phone_number is not null and p.phone is not null and p.phone = t.phone_number)
  );

create unique index if not exists communication_messages_provider_message_id_unique
  on public.communication_messages (organization_id, provider_message_id)
  where provider_message_id is not null;

create or replace function public.oculivo_protect_signed_clinical_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.signed_at is not null then
    raise exception 'Signed clinical records are immutable'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_records_signed_immutable on public.clinical_records;
create trigger clinical_records_signed_immutable
before update or delete on public.clinical_records
for each row execute function public.oculivo_protect_signed_clinical_record();

create or replace function public.oculivo_enforce_appointment_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_conflict uuid;
begin
  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception 'Appointment end time must be after start time'
      using errcode = '22007';
  end if;

  if new.provider_id is null or coalesce(new.status,'') in ('cancelled','canceled') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.organization_id::text || ':' || new.provider_id::text, 0)
  );

  select a.id
    into v_conflict
  from public.appointments a
  where a.organization_id = new.organization_id
    and a.provider_id = new.provider_id
    and (new.id is null or a.id <> new.id)
    and coalesce(a.status,'') not in ('cancelled','canceled')
    and a.starts_at < new.ends_at
    and a.ends_at > new.starts_at
  limit 1;

  if v_conflict is not null then
    raise exception 'Provider already has an overlapping appointment'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_integrity_guard on public.appointments;
create trigger appointments_integrity_guard
before insert or update on public.appointments
for each row execute function public.oculivo_enforce_appointment_integrity();

create or replace function public.oculivo_preserve_appointment_history()
returns trigger
language plpgsql
set search_path = public
as $
begin
  raise exception 'Appointments must be cancelled, not deleted'
    using errcode = '55000';
end;
$;

drop trigger if exists appointments_no_delete on public.appointments;
create trigger appointments_no_delete
before delete on public.appointments
for each row execute function public.oculivo_preserve_appointment_history();

commit;
