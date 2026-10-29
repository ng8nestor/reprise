-- keep_alive: a function that returns the text 'ok' and nothing else. A
-- scheduled GitHub Actions workflow calls it once a day so the free
-- Supabase project keeps receiving a little database activity and doesn't
-- get paused for inactivity (.github/workflows/keep-alive.yml).
--
-- Security model:
-- - It reads no tables, no settings, no user data. There is nothing in it
--   for a caller to learn or change, so letting "anon" run it exposes
--   nothing. This is the only thing anon can do in this project; anon still
--   has no grant on any table.
-- - security invoker + set search_path = '': it runs with the caller's
--   (anon's) own privileges and resolves no names through a search_path.
-- - stable: it has no side effects.
-- - The grants at the bottom make anon the only role that can call it.
--
-- Called with: POST {project url}/rest/v1/rpc/keep_alive
--              (header: apikey: {publishable key}, body: {})

create function public.keep_alive()
returns text
language sql
security invoker
stable
set search_path = ''
as $$
  select 'ok'::text;
$$;


-- ===========================================================================
-- Grants
-- ===========================================================================

-- New functions are executable by PUBLIC (everyone) by default. Start from
-- nothing, then let only anon call it. "authenticated" is a separate role
-- and the app never needs this function, so it gets no grant.
revoke all on function public.keep_alive() from public, anon, authenticated;

grant execute on function public.keep_alive() to anon;
