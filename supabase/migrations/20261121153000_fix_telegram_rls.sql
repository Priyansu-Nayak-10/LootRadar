drop policy if exists "Users can delete their Telegram connection"
  on public.telegram_connections;
create policy "Users can delete their Telegram connection"
  on public.telegram_connections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their sent alerts"
  on public.sent_alerts;
create policy "Users can insert their sent alerts"
  on public.sent_alerts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their sent alerts"
  on public.sent_alerts;
create policy "Users can delete their sent alerts"
  on public.sent_alerts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
