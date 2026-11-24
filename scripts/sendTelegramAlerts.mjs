import {
  shouldSendWishlistAlert,
  isConsoleGame,
} from '../src/lib/wishlistAlerts.js'

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
  if (response.status === 204) return null
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Supabase ${method} ${path} returned invalid JSON`)
  }
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
  console.log('SENDER_PHASE=loading_snapshots')
  const epic = await loadJson(new URL('../public/data/epic-free-games.json', import.meta.url))
  const gamerPower = await loadJson(
    new URL('../public/data/gamerpower-free-games.json', import.meta.url)
  )
  let cheapshark = { deals: [], stores: [] }
  try {
    cheapshark = await loadJson(new URL('../public/data/cheapshark-deals.json', import.meta.url))
  } catch {
    console.warn('CheapShark deals snapshot unavailable for wishlist matching')
  }

  const storeMap = new Map()
  for (const s of cheapshark.stores || []) {
    storeMap.set(String(s.storeID), s.storeName)
  }

  const cheapsharkDealsMap = new Map()
  for (const d of cheapshark.deals || []) {
    const key = normalizeTitle(d.title)
    const existing = cheapsharkDealsMap.get(key)
    if (!existing || Number(d.salePrice) < Number(existing.salePrice)) {
      cheapsharkDealsMap.set(key, d)
    }
  }

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
    console.log('SENDER_PHASE=upserting_free_game_windows')
    await supabase(
      'POST',
      'free_game_windows?on_conflict=game_key',
      windows,
      'resolution=merge-duplicates,return=minimal'
    )
  }

  // Fetch all data needed for alert decisions in a single parallel batch.
  // Wishlists for all users are loaded once here and grouped by user_id in
  // memory below, avoiding one Supabase query per (user × game) combination.
  const [settings, connections, library, wishlistRows, sentAlerts] = await Promise.all([
    supabase('GET', 'notification_settings?select=*'),
    supabase('GET', 'telegram_connections?select=*&active=eq.true'),
    supabase('GET', 'saved_games?select=user_id,title,normalized_title,platform,list_type&list_type=eq.library'),
    supabase('GET', 'saved_games?select=id,user_id,title,normalized_title,platform,notify,last_alerted_at,last_alerted_discount,last_alerted_price,alert_count_this_week,alert_week_start&list_type=eq.wishlist'),
    supabase('GET', 'sent_alerts?select=*'),
  ])
  console.log(`SENDER_PHASE=settings_loaded settings=${settings.length} connections=${connections.length}`)

  const ownedTitlesByUser = new Map()
  for (const game of library) {
    if (!ownedTitlesByUser.has(game.user_id)) {
      ownedTitlesByUser.set(game.user_id, new Set())
    }
    ownedTitlesByUser
      .get(game.user_id)
      .add(normalizeTitle(game.normalized_title || game.title))
  }

  // Group pre-fetched wishlist rows by user_id so the per-window loop needs
  // no additional Supabase queries.
  const wishlistTitlesByUser = new Map()
  const wishlistGamesByUser = new Map()
  for (const game of wishlistRows) {
    if (!wishlistTitlesByUser.has(game.user_id)) {
      wishlistTitlesByUser.set(game.user_id, new Set())
      wishlistGamesByUser.set(game.user_id, [])
    }
    wishlistTitlesByUser
      .get(game.user_id)
      .add(normalizeTitle(game.normalized_title || game.title))
    wishlistGamesByUser.get(game.user_id).push(game)
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
        const wishedTitles = wishlistTitlesByUser.get(setting.user_id) || new Set()
        if (!wishedTitles.has(window.normalized_title)) continue
      }

      if (setting.mode === 'platform') {
        const selected = Array.isArray(setting.platforms) ? setting.platforms : []
        const matchesPlatform = selected.some((platform) =>
          window.platform.toLowerCase().includes(platform.toLowerCase().replace('.io', ''))
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

  // ─── Process Wishlist Price Drop Deals ──────────────────────────────────────
  console.log('SENDER_PHASE=evaluating_wishlist_deals')

  // Find all unique PC wishlisted titles across active users with notifications enabled
  const activeUserIds = new Set(
    settings
      .filter((s) => s.enabled && connections.some((c) => c.user_id === s.user_id))
      .map((s) => s.user_id)
  )

  const uniqueWishlistTitles = new Set()
  for (const game of wishlistRows) {
    if (!activeUserIds.has(game.user_id)) continue
    if (game.notify === false) continue
    if (isConsoleGame(game.platform)) continue
    const norm = normalizeTitle(game.normalized_title || game.title)
    const userOwned = ownedTitlesByUser.get(game.user_id) || new Set()
    if (!userOwned.has(norm)) {
      uniqueWishlistTitles.add(game.title)
    }
  }

  // Fetch live deals for wishlisted titles not found in the global snapshot
  for (const rawTitle of uniqueWishlistTitles) {
    const norm = normalizeTitle(rawTitle)
    if (cheapsharkDealsMap.has(norm)) continue

    try {
      const cleanQuery = rawTitle.replace(/\s*\(.*?\)/g, '').trim()
      const searchUrl = `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(cleanQuery)}&pageSize=1`
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'LootRadar/1.0 (free portfolio project)' },
      })
      if (res.ok) {
        const results = await res.json()
        if (Array.isArray(results) && results[0]) {
          cheapsharkDealsMap.set(norm, results[0])
          // Also map by result title's normalized form
          const resultNorm = normalizeTitle(results[0].title)
          if (!cheapsharkDealsMap.has(resultNorm)) {
            cheapsharkDealsMap.set(resultNorm, results[0])
          }
        }
      }
    } catch (err) {
      console.warn(`CheapShark lookup failed for "${rawTitle}":`, err.message)
    }
  }

  let wishlistAlertsSent = 0
  for (const setting of settings) {
    if (!setting.enabled) continue
    const connection = connections.find((item) => item.user_id === setting.user_id)
    if (!connection) continue

    const userWishlist = wishlistGamesByUser.get(setting.user_id) || []
    const ownedTitles = ownedTitlesByUser.get(setting.user_id) || new Set()
    const sensitivity = setting.alert_sensitivity || 'good'

    for (const game of userWishlist) {
      if (game.notify === false) continue
      if (isConsoleGame(game.platform)) continue
      const normTitle = normalizeTitle(game.normalized_title || game.title)
      if (ownedTitles.has(normTitle)) continue

      const deal = cheapsharkDealsMap.get(normTitle)
      if (deal && (deal.isOnSale === '1' || Number(deal.savings) >= 15)) {
        const decision = shouldSendWishlistAlert({
          gameRecord: game,
          deal,
          sensitivity,
          now,
        })

        if (decision.shouldAlert) {
          const storeName = storeMap.get(String(deal.storeID)) || 'PC Store'
          const discountPercent = Math.round(Number(deal.savings))
          const salePriceStr = Number(deal.salePrice).toFixed(2)
          const normalPriceStr = Number(deal.normalPrice).toFixed(2)
          const dealLink = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`

          const text = [
            `🎯 Wishlist Deal Alert: ${game.title}`,
            `Discount: -${discountPercent}% (${decision.reason})`,
            `Price: $${salePriceStr} USD (was $${normalPriceStr})`,
            `Store: ${storeName}`,
            dealLink,
          ].join('\n')

          const result = await telegramSend(connection.chat_id, text)
          if (result.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, (result.retryAfter + 1) * 1000))
            continue
          }
          if (result.status === 200) {
            wishlistAlertsSent++
            await supabase(
              'PATCH',
              `saved_games?id=eq.${game.id}`,
              {
                last_alerted_at: now.toISOString(),
                last_alerted_discount: discountPercent,
                last_alerted_price: Number(deal.salePrice),
                alert_count_this_week: decision.currentWeekCount,
                alert_week_start: decision.isNewWeek ? now.toISOString() : game.alert_week_start,
              },
              'return=minimal'
            ).catch((err) => console.error('Error updating saved game alert state:', err.message))
          }
        }
      } else if (game.last_alerted_at && (!deal || deal.isOnSale !== '1' || Number(deal.savings) < 15)) {
        // Sale has ended; reset last_alerted state so next sale can alert fresh
        await supabase(
          'PATCH',
          `saved_games?id=eq.${game.id}`,
          {
            last_alerted_discount: null,
            last_alerted_price: null,
          },
          'return=minimal'
        ).catch(() => {})
      }
    }
  }

  console.log(`Processed wishlist deals, sent ${wishlistAlertsSent} wishlist alerts`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
