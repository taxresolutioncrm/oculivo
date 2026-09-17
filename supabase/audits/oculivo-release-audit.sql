-- Oculivo production release audit (read-only)
-- Run against the Oculivo project after applying the release migrations.

-- 1) Every public table must have RLS enabled.
select
  count(*) filter (where relrowsecurity) as rls_enabled,
  count(*) as public_tables,
  count(*) filter (where not relrowsecurity) as tables_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- 2) Every RLS table should have at least one policy.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
 group by c.relname
having count(p.policyname)=0
order by c.relname;

-- 3) Sensitive-table policies used by the Oculivo role gate.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in (
    'clinical_records','communication_threads','communication_messages',
    'documents','support_tickets','time_entries','team_channels','team_messages'
  )
order by tablename, policyname;

-- 4) Required private storage buckets and limits.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('oculivo-documents','universal-esign')
order by id;

-- 5) Active organization membership inventory (no secrets).
select role, is_active, count(*) as memberships
from public.organization_memberships
group by role, is_active
order by role, is_active;

-- Expected release conditions:
-- * tables_without_rls = 0
-- * query #2 returns zero rows
-- * universal-esign is private, 25 MB, PDF/JSON only
-- * communication read roles exclude billing/read_only
-- * clinical read roles are owner/admin/manager/provider
