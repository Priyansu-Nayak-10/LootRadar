const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
}

requireEnv('SUPABASE_URL', SUPABASE_URL)
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_KEY)
requireEnv('TELEGRAM_BOT_TOKEN', TELEGRAM_BOT_TOKEN)

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

async function supabase(method, path, body, prefer) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (prefer) headers.Prefer = prefer

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${detail}`)
  }
  return response.status === 204 ? null : response.json()
}

async function loadJson(path) {
  const fs = await import('node:fs/promises')
  return JSON.parse(await fs.readFile(path, 'utf8'))
}

function istLabel(value) {
  if (!value) return 'time TBA'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function parseUtc(value) {
  if (!value || value === 'N/A') return null
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('T') ? '' : 'Z'))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function telegramSend(chatId, text) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    }
  )

  if (response.status === 429) {
    const data = await response.json()
    return { status: 429, retryAfter: Number(data.parameters?.retry_after || 30) }
  }

  if (response.status === 403) {
    await supabase(
      'PATCH',
      `telegram_connections?chat_id=eq.${encodeURIComponent(chatId)}`,
      { active: false, inactive_reason: 'Telegram 403: user blocked or deactivated bot' },
      'return=minimal'
    )
    return { status: 403 }
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Telegram send failed (${response.status}): ${detail}`)
  }
  return { status: 200 }
}

function dueAt(now, target, toleranceMs = 45 * 60 * 1000) {
  if (!target) return false
  const distance = now.getTime() - target.getTime()
  return distance >= -10 * 60 * 1000 && distance <= toleranceMs
}

async function main() {
  const epic = await loadJson(new URL('../public/data/epic-free-games.json', import.meta.url))
  const gamerPower = await loadJson(
    new URL('../public/data/gamerpower-free-games.json', import.meta.url)
  )

  const windows = []
  for (const game of epic.current || []) {
    windows.push({
      game_key: `epic:${game.id}:${game.startDate}:${game.endDate}`,
      title: game.title,
      normalized_title: normalizeTitle(game.title),
      platform: 'Epic',
      source: 'Epic Games Store',
      start_at: game.startDate,
      end_at: game.endDate,
      link: `https://store.epicgames.com/en-US/p/${game.slug}`,
      image: game.image || '',
      updated_at: new Date().toISOString(),
    })
  }
  for (const game of epic.upcoming || []) {
    windows.push({
      game_key: `epic:${game.id}:${game.startDate}:${game.endDate}`,
      title: game.title,
      normalized_title: normalizeTitle(game.title),
      platform: 'Epic',
      source: 'Epic Games Store',
      start_at: game.startDate,
      end_at: game.endDate,
      link: `https://store.epicgames.com/en-US/p/${game.slug}`,
      image: game.image || '',
      updated_at: new Date().toISOString(),
    })
  }
  for (const game of gamerPower.games || []) {
    const end = parseUtc(game.end_date)
    windows.push({
      game_key: `gamerpower:${game.id}:${end || 'unknown'}`,
      title: game.title,
      normalized_title: normalizeTitle(game.title),
      platform: game.platforms || 'PC',
      source: 'GamerPower',
      start_at: null,
      end_at: end,
      link: game.open_giveaway_url || game.gamerpower_url || 'https://www.gamerpower.com',
      image: game.thumbnail || '',
      updated_at: new Date().toISOString(),
    })
  }

  if (windows.length > 0) {
    await supabase(
      'POST',
      'free_game_windows?on_conflict=game_key',
      windows,
      'resolution=merge-duplicates,return=minimal'
    )
  }

  const [settings, connections, library, sentAlerts] = await Promise.all([
    supabase('GET', 'notification_settings?select=*'),
    supabase('GET', 'telegram_connections?select=*&active=eq.true'),
    supabase('GET', 'saved_games?select=user_id,title,normalized_title,platform,list_type&list_type=eq.library'),
    supabase('GET', 'sent_alerts?select=*'),
  ])

  const ownedTitlesByUser = new Map()
  for (const game of library) {
    if (!ownedTitlesByUser.has(game.user_id)) {
      ownedTitlesByUser.set(game.user_id, new Set())
    }
    ownedTitlesByUser
      .get(game.user_id)
      .add(normalizeTitle(game.normalized_title || game.title))
  }
  const sentKeys = new Set(
    sentAlerts.map((alert) =>
      `${alert.user_id}|${alert.game_key}|${alert.window_start}|${alert.alert_kind}`
    )
  )

  const now = new Date()
  for (const setting of settings) {
    if (!setting.enabled) continue
    const connection = connections.find((item) => item.user_id === setting.user_id)
    if (!connection) continue
    const ownedTitles = ownedTitlesByUser.get(setting.user_id) || new Set()

    for (const window of windows) {
      if (ownedTitles.has(window.normalized_title)) continue

      if (setting.mode === 'wishlist') {
        const wishlist = await supabase(
          'GET',
          `saved_games?select=title,normalized_title&user_id=eq.${setting.user_id}&list_type=eq.wishlist`
        )
        const wished = wishlist.some((game) =>
          normalizeTitle(game.normalized_title || game.title) === window.normalized_title
        )
        if (!wished) continue
      }

      if (setting.mode === 'platform') {
        const selected = Array.isArray(setting.platforms) ? setting.platforms : []
        const matchesPlatform = selected.some((platform) =>
          window.platform.toLowerCase().includes(platform.toLower().replace('.io', ''))
        )
        if (!matchesPlatform) continue
      }

      const start = window.start_at ? new Date(window.start_at) : null
      const end = window.end_at ? new Date(window.end_at) : null
      const candidateAlerts = []

      if (start) {
        candidateAlerts.push({
          kind: 'day_before',
          target: new Date(start.getTime() - 24 * 60 * 60 * 1000),
        })
        if (end) {
          candidateAlerts.push({
            kind: 'mid_window',
            target: new Date(start.getTime() + (end.getTime() - start.getTime()) / 2),
          })
        }
      }
      if (end) {
        candidateAlerts.push({
          kind: 'ending_soon',
          target: new Date(
            end.getTime() - Number(setting.ending_hours || 6) * 60 * 60 * 1000
          ),
        })
      }

      for (const candidate of candidateAlerts) {
        if (!dueAt(now, candidate.target)) continue
        const windowStart = start ? start.toISOString() : end ? end.toISOString() : null
        const sentKey = `${setting.user_id}|${window.game_key}|${windowStart}|${candidate.kind}`
        if (sentKeys.has(sentKey)) continue

        const text = [
          `Free game: ${window.title}`,
          `Platform: ${window.platform}`,
          `Ends: ${istLabel(window.end_at)}`,
          window.link,
        ].join('\n')

        const result = await telegramSend(connection.chat_id, text)
        if (result.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, (result.retryAfter + 1) * 1000))
          continue
        }
        if (result.status !== 200) continue

        await supabase(
          'POST',
          'sent_alerts?on_conflict=user_id,game_key,window_start,alert_kind',
          [{
            user_id: setting.user_id,
            game_key: window.game_key,
            window_start: windowStart,
            alert_kind: candidate.kind,
          }],
          'resolution=ignore-duplicates,return=minimal'
        )
        sentKeys.add(sentKey)
      }
    }
  }

  console.log(`Processed ${windows.length} free-game windows`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
