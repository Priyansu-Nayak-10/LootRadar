-- Drop the legacy unique constraint on (user_id, game_key, alert_kind) while keeping
-- the window-scoped unique index sent_alerts_unique_window_alert on
-- (user_id, game_key, window_start, alert_kind).
-- Why: game_key is now title-based (title:<dedupeKey>), so the same game title
-- appearing in a later free window must be allowed to alert again.

do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'sent_alerts'
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname::text)
      from unnest(c.conkey) as k(attnum)
      join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
    ) = array['alert_kind', 'game_key', 'user_id']::text[];

  if v_constraint_name is not null then
    execute format('alter table public.sent_alerts drop constraint if exists %I', v_constraint_name);
  end if;
end
$$;
