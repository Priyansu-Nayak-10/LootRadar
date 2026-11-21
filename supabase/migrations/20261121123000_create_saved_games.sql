create table if not exists public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_type text not null check (list_type in ('library', 'wishlist')),
  title text not null,
  title_key text generated always as (lower(btrim(title))) stored,
  platform text,
  image text,
  notes text,
  source text,
  source_id text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, list_type, title_key)
);

create index if not exists saved_games_user_list_idx
  on public.saved_games (user_id, list_type);

alter table public.saved_games enable row level security;

drop policy if exists "Users can view their saved games"
  on public.saved_games;
create policy "Users can view their saved games"
  on public.saved_games
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their saved games"
  on public.saved_games;
create policy "Users can insert their saved games"
  on public.saved_games
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their saved games"
  on public.saved_games;
create policy "Users can update their saved games"
  on public.saved_games
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their saved games"
  on public.saved_games;
create policy "Users can delete their saved games"
  on public.saved_games
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
