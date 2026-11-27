-- =============================================================================
-- WishRadar Database Manual Sync Script
-- Idempotent schema reconciliation covering all migrations.
-- Safe to run repeatedly in the Supabase Dashboard SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: public.saved_games
-- -----------------------------------------------------------------------------
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

-- Columns added in subsequent migrations
alter table public.saved_games
  add column if not exists normalized_title text,
  add column if not exists alert_on_free boolean not null default true,
  add column if not exists alert_discount_percent integer,
  add column if not exists alert_target_price numeric(10, 2),
  add column if not exists notify boolean not null default true,
  add column if not exists last_alerted_at timestamptz,
  add column if not exists last_alerted_discount integer,
  add column if not exists last_alerted_price numeric(10, 2),
  add column if not exists alert_count_this_week integer not null default 0,
  add column if not exists alert_week_start timestamptz;

-- Constraints on saved_games alert preferences
alter table public.saved_games
  drop constraint if exists saved_games_alert_discount_percent_check;
alter table public.saved_games
  add constraint saved_games_alert_discount_percent_check
  check (alert_discount_percent is null or (alert_discount_percent >= 1 and alert_discount_percent <= 100));

alter table public.saved_games
  drop constraint if exists saved_games_alert_target_price_check;
alter table public.saved_games
  add constraint saved_games_alert_target_price_check
  check (alert_target_price is null or alert_target_price >= 0);

-- Backfill normalized_title if null
update public.saved_games
set normalized_title = regexp_replace(
  lower(coalesce(title, '')),
  '[^a-z0-9]+',
  '',
  'g'
)
where normalized_title is null;

-- Trigger to maintain normalized_title on insert/update of title
create or replace function public.set_saved_game_normalized_title()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.normalized_title := regexp_replace(
    lower(coalesce(new.title, '')),
    '[^a-z0-9]+',
    '',
    'g'
  );
  return new;
end;
$$;

drop trigger if exists set_saved_game_normalized_title on public.saved_games;
create trigger set_saved_game_normalized_title
before insert or update of title on public.saved_games
for each row execute function public.set_saved_game_normalized_title();

-- RLS for saved_games
alter table public.saved_games enable row level security;

drop policy if exists "Users can view their saved games" on public.saved_games;
create policy "Users can view their saved games"
  on public.saved_games
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their saved games" on public.saved_games;
create policy "Users can insert their saved games"
  on public.saved_games
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their saved games" on public.saved_games;
create policy "Users can update their saved games"
  on public.saved_games
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their saved games" on public.saved_games;
create policy "Users can delete their saved games"
  on public.saved_games
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 2. Table: public.telegram_link_codes
-- -----------------------------------------------------------------------------
create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (code),
  unique (user_id)
);

alter table public.telegram_link_codes enable row level security;

drop policy if exists "Users can manage their Telegram link codes" on public.telegram_link_codes;
create policy "Users can manage their Telegram link codes"
  on public.telegram_link_codes
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 3. Table: public.telegram_connections
-- -----------------------------------------------------------------------------
create table if not exists public.telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  chat_id text not null unique,
  username text,
  connected_at timestamptz not null default timezone('utc', now())
);

alter table public.telegram_connections
  add column if not exists active boolean not null default true,
  add column if not exists inactive_reason text;

create index if not exists telegram_connections_active_idx
  on public.telegram_connections (active);

alter table public.telegram_connections enable row level security;

drop policy if exists "Users can view their Telegram connection" on public.telegram_connections;
create policy "Users can view their Telegram connection"
  on public.telegram_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their Telegram connection" on public.telegram_connections;
create policy "Users can delete their Telegram connection"
  on public.telegram_connections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 4. Table: public.notification_settings
-- -----------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'all'
    check (mode in ('all', 'wishlist', 'platform')),
  platforms text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_settings
  add column if not exists enabled boolean not null default true,
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists ending_hours integer not null default 6
    check (ending_hours between 1 and 24),
  add column if not exists alert_sensitivity text not null default 'good'
    check (alert_sensitivity in ('any', 'good', 'great'));

alter table public.notification_settings enable row level security;

drop policy if exists "Users can manage their notification settings" on public.notification_settings;
create policy "Users can manage their notification settings"
  on public.notification_settings
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 5. Table: public.sent_alerts
-- -----------------------------------------------------------------------------
create table if not exists public.sent_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  alert_kind text not null,
  sent_at timestamptz not null default timezone('utc', now())
);

alter table public.sent_alerts
  add column if not exists window_start timestamptz,
  add column if not exists alert_kind text;

create unique index if not exists sent_alerts_unique_window_alert
  on public.sent_alerts (user_id, game_key, window_start, alert_kind);

alter table public.sent_alerts enable row level security;

drop policy if exists "Users can view their sent alerts" on public.sent_alerts;
create policy "Users can view their sent alerts"
  on public.sent_alerts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their sent alerts" on public.sent_alerts;
create policy "Users can insert their sent alerts"
  on public.sent_alerts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their sent alerts" on public.sent_alerts;
create policy "Users can delete their sent alerts"
  on public.sent_alerts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 6. Table: public.free_game_windows
-- -----------------------------------------------------------------------------
create table if not exists public.free_game_windows (
  id uuid primary key default gen_random_uuid(),
  game_key text not null unique,
  title text not null,
  normalized_title text not null,
  platform text not null default '',
  source text not null,
  start_at timestamptz,
  end_at timestamptz,
  link text,
  image text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.free_game_windows enable row level security;

drop policy if exists "Authenticated users can read free game windows" on public.free_game_windows;
create policy "Authenticated users can read free game windows"
  on public.free_game_windows
  for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 7. Table: public.game_price_ids
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 8. Reload PostgREST Schema Cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
