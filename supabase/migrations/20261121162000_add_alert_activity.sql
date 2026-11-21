alter table public.telegram_connections
  add column if not exists active boolean not null default true,
  add column if not exists inactive_reason text;

create index if not exists telegram_connections_active_idx
  on public.telegram_connections (active);
