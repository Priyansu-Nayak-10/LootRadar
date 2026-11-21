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

create table if not exists public.telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  chat_id text not null unique,
  username text,
  connected_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'all'
    check (mode in ('all', 'wishlist', 'platform')),
  platforms text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sent_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  alert_kind text not null
    check (alert_kind in ('day_before', 'mid_window', 'ending_soon')),
  sent_at timestamptz not null default timezone('utc', now()),
  unique (user_id, game_key, alert_kind)
);

alter table public.telegram_link_codes enable row level security;
alter table public.telegram_connections enable row level security;
alter table public.notification_settings enable row level security;
alter table public.sent_alerts enable row level security;

create policy "Users can manage their Telegram link codes"
  on public.telegram_link_codes
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can view their Telegram connection"
  on public.telegram_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can manage their notification settings"
  on public.notification_settings
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can view their sent alerts"
  on public.sent_alerts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
