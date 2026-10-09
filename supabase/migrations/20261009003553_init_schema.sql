-- Initial schema for reprise v0.1: books, pages, highlights, and the
-- private bucket for page photos.
--
-- Security model in one paragraph: every row carries the id of the user who
-- owns it. Row Level Security (RLS) is on for every table, and each table has
-- one policy per operation that only lets a signed-in user touch their own
-- rows. The project does not expose new tables automatically, so each table
-- also gets explicit GRANTs: signed-in users (the "authenticated" role) get
-- select/insert/update/delete, and anonymous visitors ("anon") get nothing.
-- Child rows can only point at a parent with the same owner; that's
-- enforced by composite foreign keys on (parent id, user_id), not by RLS.


-- ===========================================================================
-- Tables
-- ===========================================================================

-- A book I'm reading. "kind" changes how I annotate, so it's required.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  author text,
  kind text not null,

  -- A title must contain at least one non-whitespace character
  -- (same rule as "non-empty after trim").
  constraint books_title_not_blank check (title ~ '\S'),
  constraint books_kind_allowed check (kind in ('nonfiction', 'biography')),
  -- id alone is already unique; this pair exists so pages can point at
  -- (book id, owner) together. See the foreign key on pages.
  constraint books_id_user_unique unique (id, user_id)
);

-- One photographed page of a book. The photo lives in Storage; we only keep
-- its path inside the bucket (e.g. "<user_id>/<page_id>.jpg"), never a URL,
-- because signed URLs expire. raw_extraction is the model's validated reply,
-- kept so we can compare it with my edits and re-run evals later.
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  book_id uuid not null,
  page_number int not null,
  photo_path text not null,
  raw_extraction jsonb,
  prompt_version text,

  constraint pages_page_number_positive check (page_number > 0),
  -- A book can't have the same page twice.
  constraint pages_book_page_unique unique (book_id, page_number),
  -- Lets highlights point at (page id, owner) together.
  constraint pages_id_user_unique unique (id, user_id),
  -- The page's book must exist AND belong to the same user as the page.
  -- A plain foreign key on book_id would only check that the book exists,
  -- so I could attach my page to someone else's book if I knew its id.
  -- Matching on both columns makes that impossible for every role,
  -- including server code that bypasses RLS.
  constraint pages_book_same_owner_fk foreign key (book_id, user_id)
    references public.books (id, user_id) on delete cascade
);

-- One highlighted passage on a page, plus the pen codes and symbols I wrote
-- next to it, and its place in the Leitner review schedule.
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  page_id uuid not null,
  position int not null,
  color text not null,
  text text not null,
  codes text[] not null default '{}',
  symbols text[] not null default '{}',
  -- Leitner box 1-5 (1/3/7/14/30 days, see DECISIONS.md). New highlights
  -- start in box 1 and are first due tomorrow.
  box smallint not null default 1,
  due_on date not null default current_date + 1,

  -- Order of the highlight on the page, top to bottom, starting at 1.
  constraint highlights_position_positive check (position > 0),
  constraint highlights_text_not_blank check (text ~ '\S'),
  constraint highlights_box_range check (box between 1 and 5),
  -- A page can't have two highlights in the same position.
  constraint highlights_page_position_unique unique (page_id, position),
  -- Same idea as on pages: the highlight's page must belong to the same
  -- user as the highlight.
  constraint highlights_page_same_owner_fk foreign key (page_id, user_id)
    references public.pages (id, user_id) on delete cascade,

  -- The fixed vocabulary from shared/vocabulary.ts. These three lists are
  -- checked against that file by test/vocabulary-sql.test.ts, so if you
  -- change one, change the other too.
  constraint highlights_color_allowed check (color in ('pink', 'yellow')),
  -- "<@" means "is contained in": every element of codes must be one of the
  -- allowed codes. An empty list passes; a NULL element fails.
  constraint highlights_codes_allowed check (
    codes <@ array['H', 'A', 'C', 'RCT', 'Obs', 'Meta', 'n=', 'M', 'anec', 'L']::text[]
  ),
  -- Symbols are stored by name, not glyph (try = ✓, doubt = ?,
  -- surprise = !, disagree = ✗, connects = →), matching vocabulary.ts.
  constraint highlights_symbols_allowed check (
    symbols <@ array['try', 'doubt', 'surprise', 'disagree', 'connects']::text[]
  )
);


-- ===========================================================================
-- Indexes
-- ===========================================================================

-- "Pages of a book" and "highlights on a page" need no extra index: the
-- unique constraints (book_id, page_number) and (page_id, position) already
-- create indexes that start with book_id and page_id.

-- Daily review: "my highlights that are due on or before today".
create index highlights_user_id_due_on_idx
  on public.highlights (user_id, due_on);

-- Filter by code: "highlights tagged RCT". GIN makes array containment
-- queries (codes @> '{RCT}') fast.
create index highlights_codes_gin_idx
  on public.highlights using gin (codes);


-- ===========================================================================
-- Grants: who can reach these tables through the Data API at all
-- ===========================================================================

-- Start from a clean slate so the privileges are exactly what's written
-- here, whatever the project's defaults are. This also makes sure nobody
-- gets TRUNCATE, which would skip RLS entirely.
revoke all on table public.books, public.pages, public.highlights
  from anon, authenticated;

-- Signed-in users can read and write. RLS (below) narrows that to their
-- own rows. Anonymous visitors get no grant, so every request from them is
-- refused before RLS is even consulted.
grant select, insert, update, delete
  on table public.books, public.pages, public.highlights
  to authenticated;


-- ===========================================================================
-- Row Level Security: which rows a signed-in user can touch
-- ===========================================================================

-- Automatic RLS is on for this project, but we turn it on explicitly so
-- this file doesn't depend on that setting.
alter table public.books enable row level security;
alter table public.pages enable row level security;
alter table public.highlights enable row level security;

-- Every policy compares the row's user_id with the signed-in user's id.
-- "(select auth.uid())" instead of "auth.uid()" makes Postgres look the id
-- up once per query instead of once per row.
--
-- For updates, "using" decides which existing rows you can target and
-- "with check" decides what the row may look like afterwards. Having both
-- stops someone from handing their row over to another user_id.


-- --- books -----------------------------------------------------------------

create policy "books: owner can select"
  on public.books for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "books: owner can insert"
  on public.books for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "books: owner can update"
  on public.books for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "books: owner can delete"
  on public.books for delete to authenticated
  using ((select auth.uid()) = user_id);


-- --- pages -----------------------------------------------------------------
-- These only check the page's own user_id. That the page's book is mine too
-- is guaranteed by the (book_id, user_id) foreign key on the table.

create policy "pages: owner can select"
  on public.pages for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "pages: owner can insert"
  on public.pages for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "pages: owner can update"
  on public.pages for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "pages: owner can delete"
  on public.pages for delete to authenticated
  using ((select auth.uid()) = user_id);


-- --- highlights ------------------------------------------------------------
-- Same as pages: the (page_id, user_id) foreign key guarantees the page is
-- mine, so the policies only check the highlight's own user_id.

create policy "highlights: owner can select"
  on public.highlights for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "highlights: owner can insert"
  on public.highlights for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "highlights: owner can update"
  on public.highlights for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "highlights: owner can delete"
  on public.highlights for delete to authenticated
  using ((select auth.uid()) = user_id);


-- ===========================================================================
-- Storage: private bucket for page photos
-- ===========================================================================

-- Private (no public URLs; the app asks for short-lived signed URLs),
-- 5 MiB per file, JPEG only. "on conflict" makes this safe to run even if
-- the bucket was already created by hand, and resets it to these settings.
insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  ('page-photos', 'page-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Photo paths look like "<user_id>/<page_id>.jpg". storage.foldername()
-- splits the path into folders, and [1] is the first one, which must be the
-- signed-in user's id. storage.objects already has RLS on and is shared by
-- all buckets, so each policy also pins bucket_id.
--
-- There is deliberately no update policy: a photo is written once. That
-- also means uploads with "upsert: true" will be refused; to replace a
-- photo, delete it and upload again.

create policy "page-photos: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'page-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "page-photos: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'page-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "page-photos: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'page-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
