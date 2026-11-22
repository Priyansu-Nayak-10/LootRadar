-- Backward-compatible per-wishlist-game alert preferences.
-- Existing rows keep the safe defaults below; no saved game data is removed or rewritten.
alter table public.saved_games
  add column if not exists alert_on_free boolean not null default true,
  add column if not exists alert_discount_percent integer,
  add column if not exists alert_target_price numeric(10, 2);

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
