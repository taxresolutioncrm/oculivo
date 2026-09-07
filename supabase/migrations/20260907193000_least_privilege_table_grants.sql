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

-- Preserve each table's existing authenticated DML grants; only dangerous table-level
-- capabilities are removed here. Future public tables get no direct anon privileges.
alter default privileges in schema public revoke all on tables from anon;
