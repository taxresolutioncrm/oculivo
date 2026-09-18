begin;

alter table public.communication_messages
  add column if not exists provider_message_id text;

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
