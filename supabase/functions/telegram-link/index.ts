import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY')
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')

async function telegram(method: string, body: Record<string, unknown>) {
  if (!telegramToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

  const response = await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Telegram ${method} failed (${response.status})`)
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (
    !webhookSecret ||
    request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== webhookSecret
  ) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response('Supabase server configuration missing', { status: 500 })
  }

  let update: {
    message?: {
      chat?: { id: number; username?: string }
      text?: string
    }
  }

  try {
    update = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const chat = update.message?.chat
  const text = update.message?.text?.trim() || ''
  const code = text.match(/^\/start(?:@[\w]+)?\s+(.+)$/i)?.[1]?.trim()

  if (!chat?.id) {
    return new Response('OK')
  }

  if (!code) {
    await telegram('sendMessage', {
      chat_id: chat.id,
      text: 'Open LootRadar, choose Account, and select Connect Telegram to get a one-time link.',
    })
    return new Response('OK')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const now = new Date().toISOString()

  const { data: link, error: linkError } = await supabase
    .from('telegram_link_codes')
    .select('user_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()

  if (linkError) {
    await telegram('sendMessage', {
      chat_id: chat.id,
      text: 'LootRadar could not verify this link. Please try again.',
    })
    return new Response('OK')
  }

  if (!link || link.used_at || new Date(link.expires_at).getTime() <= Date.now()) {
    await telegram('sendMessage', {
      chat_id: chat.id,
      text: 'This LootRadar link is invalid or expired. Create a new one in your Account page.',
    })
    return new Response('OK')
  }

  const { error: connectionError } = await supabase
    .from('telegram_connections')
    .upsert({
      user_id: link.user_id,
      chat_id: String(chat.id),
      username: chat.username || null,
      connected_at: now,
    }, { onConflict: 'user_id' })

  if (connectionError) {
    await telegram('sendMessage', {
      chat_id: chat.id,
      text: 'LootRadar could not save this connection. Please try again.',
    })
    return new Response('OK')
  }

  const { error: usedError } = await supabase
    .from('telegram_link_codes')
    .update({ used_at: now })
    .eq('code', code)
    .is('used_at', null)

  if (usedError) {
    return new Response('OK')
  }

  await telegram('sendMessage', {
    chat_id: chat.id,
    text: 'Telegram connected successfully to LootRadar. Free-game alerts are ready to be configured.',
  })

  return new Response('OK')
})
