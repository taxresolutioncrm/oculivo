-- Keep Oculivo e-sign storage private and constrained regardless of prior bucket state.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'universal-esign',
  'universal-esign',
  false,
  26214400,
  array['application/pdf','application/json']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
