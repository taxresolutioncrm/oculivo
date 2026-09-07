-- Oculivo least-privilege table grants.
-- RLS remains the row-level enforcement layer; this removes broad table capabilities.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all privileges on table %I.%I from anon', r.schemaname, r.tablename);
    execute format('revoke truncate, references, trigger on table %I.%I from authenticated', r.schemaname, r.tablename);
  end loop;
end
$$;

-- Authenticated application users keep ordinary DML subject to each table's RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Future public tables inherit the same baseline: no direct anon table access.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
