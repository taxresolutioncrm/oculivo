-- RomyLabs Admin Portal live-metrics invalidation.
-- Sends only product/schema/table identifiers. No CRM row payloads leave this project.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.romylabs_metrics_signal_gate (
  product_key text primary key,
  last_sent_at timestamptz not null default '-infinity'::timestamptz
);

alter table public.romylabs_metrics_signal_gate enable row level security;
revoke all on table public.romylabs_metrics_signal_gate from public, anon, authenticated;

create or replace function public.romylabs_admin_metrics_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  claimed text;
begin
  insert into public.romylabs_metrics_signal_gate(product_key,last_sent_at)
  values ('oculivo', now())
  on conflict (product_key) do update
    set last_sent_at=excluded.last_sent_at
    where public.romylabs_metrics_signal_gate.last_sent_at <= now() - interval '1 second'
  returning product_key into claimed;

  if claimed is null then
    return null;
  end if;

  perform net.http_post(
    url := 'https://mpxgxfqdbquzkrvvejkh.supabase.co/functions/v1/metrics-signal',
    body := jsonb_build_object(
      'product','oculivo',
      'source_schema',TG_TABLE_SCHEMA,
      'source_table',TG_TABLE_NAME
    ),
    headers := jsonb_build_object('Content-Type','application/json'),
    timeout_milliseconds := 1000
  );

  return null;
end;
$$;

revoke all on function public.romylabs_admin_metrics_changed()
  from public, anon, authenticated;

create or replace function public.romylabs_install_metrics_change_triggers()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and c.relname not like 'romylabs_metrics_%'
  loop
    if not exists (
      select 1
      from pg_trigger t
      join pg_class tc on tc.oid=t.tgrelid
      join pg_namespace tn on tn.oid=tc.relnamespace
      where not t.tgisinternal
        and t.tgname='romylabs_admin_metrics_changed'
        and tn.nspname=r.schema_name
        and tc.relname=r.table_name
    ) then
      execute format(
        'create trigger romylabs_admin_metrics_changed after insert or update or delete on %I.%I for each statement execute function public.romylabs_admin_metrics_changed()',
        r.schema_name, r.table_name
      );
    end if;
  end loop;

  if to_regclass('storage.objects') is not null
     and not exists (
       select 1
       from pg_trigger t
       join pg_class tc on tc.oid=t.tgrelid
       join pg_namespace tn on tn.oid=tc.relnamespace
       where not t.tgisinternal
         and t.tgname='romylabs_admin_metrics_changed'
         and tn.nspname='storage'
         and tc.relname='objects'
     ) then
    execute 'create trigger romylabs_admin_metrics_changed after insert or update or delete on storage.objects for each statement execute function public.romylabs_admin_metrics_changed()';
  end if;
end;
$$;

revoke all on function public.romylabs_install_metrics_change_triggers()
  from public, anon, authenticated;
grant execute on function public.romylabs_install_metrics_change_triggers()
  to service_role;

select public.romylabs_install_metrics_change_triggers();

do $$
declare r record;
begin
  for r in
    select jobid from cron.job
    where jobname='romylabs-admin-metrics-trigger-watchdog'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

-- Recovery for future schema additions only; operational changes are event-driven.
select cron.schedule(
  'romylabs-admin-metrics-trigger-watchdog',
  '* * * * *',
  $job$select public.romylabs_install_metrics_change_triggers();$job$
);
