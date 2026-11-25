-- Persistent ITAD game ID resolution cache for wishlist alerts
-- Apply with: npx supabase db push (or run in Supabase SQL Editor)

create table if not exists public.game_price_ids (
  normalized_title text primary key,
  itad_id text,
  steam_app_id text,
  resolved_at timestamptz not null default now(),
  unresolved boolean not null default false
);

alter table public.game_price_ids enable row level security;

drop policy if exists "Authenticated users can read game_price_ids" on public.game_price_ids;
create policy "Authenticated users can read game_price_ids"
  on public.game_price_ids
  for select
  to authenticated
  using (true);
