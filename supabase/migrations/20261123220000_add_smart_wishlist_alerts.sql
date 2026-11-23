-- Smart wishlist alerts and global alert sensitivity
alter table public.saved_games
  add column if not exists notify boolean not null default true,
  add column if not exists last_alerted_at timestamptz,
  add column if not exists last_alerted_discount integer,
  add column if not exists last_alerted_price numeric(10, 2),
  add column if not exists alert_count_this_week integer not null default 0,
  add column if not exists alert_week_start timestamptz;

alter table public.notification_settings
  add column if not exists alert_sensitivity text not null default 'good'
    check (alert_sensitivity in ('any', 'good', 'great'));
