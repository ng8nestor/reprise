-- save_page: writes one reviewed page and all of its highlights in a single
-- transaction, so either everything is saved or nothing is. The browser
-- uploads the photo to Storage first, then calls this with
-- supabase.rpc('save_page', {...}).
--
-- Security model:
-- - security invoker: the function runs as the signed-in user, so the
--   grants and RLS policies on pages and highlights apply exactly as if the
--   browser had inserted the rows itself. user_id comes from each table's
--   default (auth.uid()), and the composite foreign keys still check that
--   the book and the page belong to that user.
-- - set search_path = '': nothing is resolved through the caller's
--   search_path, so every table below is schema-qualified. Built-ins like
--   jsonb_to_recordset live in pg_catalog, which Postgres always searches.
-- - Only "authenticated" may execute it (see the grants at the bottom).
--
-- Arguments:
-- - due_on is the phone's local date + 1, not current_date + 1. The
--   database runs in UTC, so at 9pm in California current_date is already
--   tomorrow and new highlights would skip a day.
-- - highlights is a JSON array, one object per highlight:
--     [{"position": 1, "color": "pink", "text": "...",
--       "codes": ["H"], "symbols": ["try"]}, ...]
--   An empty array saves the page with no highlights. Text, color, codes
--   and symbols are checked by the table constraints, not here.
--
-- Errors keep their Postgres codes so the app can explain them, e.g. 23505
-- when this book already has this page number, 23503 when the book doesn't
-- exist or isn't mine.

create function public.save_page(
  page_id uuid,
  book_id uuid,
  page_number int,
  photo_path text,
  raw_extraction jsonb,
  prompt_version text,
  due_on date,
  highlights jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- jsonb_to_recordset(null) returns no rows, which would quietly save the
  -- page without its highlights. Refuse anything that isn't an array.
  if jsonb_typeof(save_page.highlights) is distinct from 'array' then
    raise exception 'highlights must be a JSON array'
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  -- Arguments are written save_page.<name> so they can never be mistaken
  -- for a column with the same name.
  insert into public.pages
    (id, book_id, page_number, photo_path, raw_extraction, prompt_version)
  values (
    save_page.page_id,
    save_page.book_id,
    save_page.page_number,
    save_page.photo_path,
    save_page.raw_extraction,
    save_page.prompt_version
  );

  -- jsonb_to_recordset turns the array into rows; JSON arrays become text[].
  -- A missing "codes" or "symbols" key becomes an empty list.
  insert into public.highlights
    (page_id, position, color, text, codes, symbols, due_on)
  select
    save_page.page_id,
    h.position,
    h.color,
    h.text,
    coalesce(h.codes, '{}'),
    coalesce(h.symbols, '{}'),
    save_page.due_on
  from jsonb_to_recordset(save_page.highlights)
    as h (position int, color text, text text, codes text[], symbols text[]);
end;
$$;


-- ===========================================================================
-- Grants
-- ===========================================================================

-- New functions are executable by PUBLIC (everyone, including anon) by
-- default. Start from nothing, then let only signed-in users call it,
-- matching the explicit grants on the tables.
revoke all on function public.save_page(
  uuid, uuid, int, text, jsonb, text, date, jsonb
) from public, anon, authenticated;

grant execute on function public.save_page(
  uuid, uuid, int, text, jsonb, text, date, jsonb
) to authenticated;
