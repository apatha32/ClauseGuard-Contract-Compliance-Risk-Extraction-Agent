-- Supabase's default local/hosted setup does not automatically grant table
-- privileges to anon/authenticated/service_role — only RLS policies gate
-- access, so without grants every role is locked out regardless of policy.
-- service_role bypasses RLS (rolbypassrls) but still needs the grant itself.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to authenticated;
