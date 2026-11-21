# Telegram link webhook

Deploy this Edge Function from the Supabase Dashboard or Supabase CLI.

Required function secrets:

- `TELEGRAM_BOT_TOKEN`: private BotFather token
- `TELEGRAM_WEBHOOK_SECRET`: random secret sent by Telegram and stored in the webhook URL

Supabase provides `SUPABASE_URL` and a server key to Edge Functions. Do not place the service/secret key or bot token in Vite variables or source files.
