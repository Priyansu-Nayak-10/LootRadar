alter table public.saved_games
  add column if not exists normalized_title text;

update public.saved_games
set normalized_title = regexp_replace(
  lower(coalesce(title, '')),
  '[^a-z0-9]+',
  '',
  'g'
)
where normalized_title is null;

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

drop policy if exists "Authenticated users can read free game windows"
  on public.free_game_windows;
create policy "Authenticated users can read free game windows"
  on public.free_game_windows
  for select
  to authenticated
  using (true);

alter table public.sent_alerts
  add column if not exists window_start timestamptz,
  add column if not exists alert_kind text;

create unique index if not exists sent_alerts_unique_window_alert
  on public.sent_alerts (user_id, game_key, window_start, alert_kind);

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
