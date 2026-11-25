import {
  shouldSendWishlistAlert,
  isConsoleGame,
} from '../src/lib/wishlistAlerts.js'
import {
  bestDeal,
  createItadClient,
  fetchPrices,
  resolveItadId,
  shouldAlert,
} from './lib/itad.mjs'

const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ITAD_API_KEY = process.env.ITAD_API_KEY

const RESOLVED_TTL_MS = 30 * 24 * 60 * 60 * 1000
const UNRESOLVED_TTL_MS = 7 * 24 * 60 * 60 * 1000

const SAMPLE_DRY_RUN_TITLES = [
  'Elden Ring',
  'Cyberpunk 2077',
  'Hades II',
  "Baldur's Gate 3",
  'Hollow Knight',
]

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
}

if (!DRY_RUN) {
  requireEnv('SUPABASE_URL', SUPABASE_URL)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_KEY)
  requireEnv('TELEGRAM_BOT_TOKEN', TELEGRAM_BOT_TOKEN)
}

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

function formatInr(amount) {
  const val = Number(amount)
  if (!Number.isFinite(val)) return '₹0'
  if (val === 0) return 'Free'
  const hasPaise = Math.abs(val - Math.trunc(val)) > 0.001
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(val)
}

async function supabase(method, path, body, prefer) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
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
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would send to chat ${chatId}:\n${text}\n---`)
    return { status: 200 }
  }

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

async function loadPriceIdCache() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return new Map()
  try {
    const rows = await supabase('GET', 'game_price_ids?select=*')
    const map = new Map()
    for (const row of rows || []) {
      map.set(row.normalized_title, row)
    }
    return map
  } catch (err) {
    console.warn('game_price_ids cache unavailable (run migration if needed):', err.message)
    return new Map()
  }
}

async function savePriceIdCache(rows) {
  if (DRY_RUN || !SUPABASE_URL || !SUPABASE_KEY || rows.length === 0) return
  try {
    await supabase(
      'POST',
      'game_price_ids?on_conflict=normalized_title',
      rows,
      'resolution=merge-duplicates,return=minimal'
    )
  } catch (err) {
    console.warn('Could not persist game_price_ids cache:', err.message)
  }
}

async function evaluateItadForTitles(titles, idCacheMap, now) {
  const dealByNormTitle = new Map()
  if (!ITAD_API_KEY || !ITAD_API_KEY.trim()) {
    console.warn('ITAD_API_KEY is missing; skipping live ITAD wishlist price evaluation.')
    return { dealByNormTitle, resolvedRows: [], summary: [] }
  }

  const client = createItadClient({ apiKey: ITAD_API_KEY.trim() })
  const nowMs = now.getTime()
  const resolvedRowsToSave = []
  const idsToFetch = []
  const normToItadId = new Map()
  const summary = []

  for (const rawTitle of titles) {
    const norm = normalizeTitle(rawTitle)
    const cached = idCacheMap.get(norm)
    const resolvedAtMs = cached?.resolved_at ? Date.parse(cached.resolved_at) : 0
    const isFresh = cached
      ? cached.unresolved
        ? nowMs - resolvedAtMs < UNRESOLVED_TTL_MS
        : nowMs - resolvedAtMs < RESOLVED_TTL_MS
      : false

    let itadId = isFresh ? cached.itad_id : null
    if (!isFresh) {
      itadId = await resolveItadId(client, rawTitle)
      const row = {
        normalized_title: norm,
        itad_id: itadId || null,
        steam_app_id: null,
        resolved_at: now.toISOString(),
        unresolved: !itadId,
      }
      resolvedRowsToSave.push(row)
    }

    if (itadId) {
      normToItadId.set(norm, itadId)
      idsToFetch.push(itadId)
    }
  }

  const priceEntries = idsToFetch.length > 0 ? await fetchPrices(client, idsToFetch) : []
  const priceById = new Map(priceEntries.map((p) => [p.id, bestDeal(p)]))

  for (const rawTitle of titles) {
    const norm = normalizeTitle(rawTitle)
    const itadId = normToItadId.get(norm) || null
    const deal = itadId ? priceById.get(itadId) || null : null
    if (deal) {
      dealByNormTitle.set(norm, deal)
    }
    const wouldAlert = deal
      ? shouldAlert({
          price: deal.price,
          regular: deal.regular,
          cut: deal.cut,
          historyLow: deal.historyLow,
          sensitivity: 'good',
        })
      : false

    summary.push({
      title: rawTitle,
      resolvedId: itadId || 'UNRESOLVED',
      bestStore: deal?.store || '-',
      priceINR: deal ? formatInr(deal.price) : '-',
      regularINR: deal ? formatInr(deal.regular) : '-',
      cut: deal ? `${Math.round(deal.cut)}%` : '-',
      lowestEver: deal?.historyLow != null ? formatInr(deal.historyLow) : '-',
      wouldAlert,
    })
  }

  return { dealByNormTitle, resolvedRows: resolvedRowsToSave, summary }
}

async function main() {
  const now = new Date()

  // Standalone DRY_RUN mode when Supabase env vars are not provided
  if (DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
    console.log('SENDER_PHASE=dry_run_standalone')
    const idCache = new Map()
    const { summary } = await evaluateItadForTitles(SAMPLE_DRY_RUN_TITLES, idCache, now)
    console.table(summary)
    return
  }

  console.log('SENDER_PHASE=loading_snapshots')
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
      updated_at: now.toISOString(),
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
      updated_at: now.toISOString(),
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
      updated_at: now.toISOString(),
    })
  }

  if (!DRY_RUN && windows.length > 0) {
    console.log('SENDER_PHASE=upserting_free_game_windows')
    await supabase(
      'POST',
      'free_game_windows?on_conflict=game_key',
      windows,
      'resolution=merge-duplicates,return=minimal'
    )
  }

  const [settings, connections, library, wishlistRows, sentAlerts, idCacheMap] = await Promise.all([
    supabase('GET', 'notification_settings?select=*'),
    supabase('GET', 'telegram_connections?select=*&active=eq.true'),
    supabase('GET', 'saved_games?select=user_id,title,normalized_title,platform,list_type&list_type=eq.library'),
    supabase('GET', 'saved_games?select=id,user_id,title,normalized_title,platform,notify,last_alerted_at,last_alerted_discount,last_alerted_price,alert_count_this_week,alert_week_start&list_type=eq.wishlist'),
    supabase('GET', 'sent_alerts?select=*'),
    loadPriceIdCache(),
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
        const windowPlatform = String(window.platform || '').toLowerCase()
        const matchesPlatform = selected.some((platform) =>
          windowPlatform.includes(String(platform || '').toLowerCase().replace('.io', ''))
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
          `Platform: ${window.platform || 'PC'}`,
          `Ends: ${istLabel(window.end_at)}`,
          window.link,
        ].join('\n')

        const result = await telegramSend(connection.chat_id, text)
        if (result.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, (result.retryAfter + 1) * 1000))
          continue
        }
        if (result.status !== 200) continue

        if (!DRY_RUN) {
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
        }
        sentKeys.add(sentKey)
      }
    }
  }

  console.log(`Processed ${windows.length} free-game windows`)

  // ─── Process Wishlist Price Drop Deals (ITAD INR) ───────────────────────────
  console.log('SENDER_PHASE=evaluating_wishlist_deals')

  const activeUserIds = new Set(
    settings
      .filter((s) => s.enabled && connections.some((c) => c.user_id === s.user_id))
      .map((s) => s.user_id)
  )

  const uniqueTitlesByNorm = new Map()
  for (const game of wishlistRows) {
    if (!activeUserIds.has(game.user_id)) continue
    if (game.notify === false) continue
    if (isConsoleGame(game.platform)) continue
    const norm = normalizeTitle(game.normalized_title || game.title)
    const userOwned = ownedTitlesByUser.get(game.user_id) || new Set()
    if (!userOwned.has(norm) && !uniqueTitlesByNorm.has(norm)) {
      uniqueTitlesByNorm.set(norm, game.title)
    }
  }

  const { dealByNormTitle, resolvedRows, summary } = await evaluateItadForTitles(
    [...uniqueTitlesByNorm.values()],
    idCacheMap,
    now
  )
  await savePriceIdCache(resolvedRows)

  if (DRY_RUN && summary.length > 0) {
    console.table(summary)
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

      const deal = dealByNormTitle.get(normTitle)
      if (deal && (deal.price === 0 || Number(deal.cut) >= 15)) {
        const adaptedDeal = {
          isFree: deal.price === 0 || Number(deal.cut) >= 100,
          salePrice: deal.price,
          price: deal.price,
          savings: deal.cut,
          lowestPrice: deal.historyLow,
        }

        const decision = shouldSendWishlistAlert({
          gameRecord: game,
          deal: adaptedDeal,
          sensitivity,
          cheapestEver: deal.historyLow,
          now,
        })

        if (decision.shouldAlert) {
          const discountPercent = Math.round(Number(deal.cut))
          const lines = [
            `🎯 Wishlist Deal Alert: ${game.title}`,
            `Store: ${deal.store || 'PC Store'}`,
            `Price: ${formatInr(deal.price)} (was ${formatInr(deal.regular)}, -${discountPercent}%)`,
          ]
          if (deal.historyLow != null) {
            lines.push(`Lowest ever: ${formatInr(deal.historyLow)}`)
          }
          if (deal.expiry) {
            lines.push(`Ends: ${istLabel(deal.expiry)}`)
          }
          if (deal.url) {
            lines.push(deal.url)
          }

          const result = await telegramSend(connection.chat_id, lines.join('\n'))
          if (result.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, (result.retryAfter + 1) * 1000))
            continue
          }
          if (result.status === 200) {
            wishlistAlertsSent++
            if (!DRY_RUN) {
              await supabase(
                'PATCH',
                `saved_games?id=eq.${game.id}`,
                {
                  last_alerted_at: now.toISOString(),
                  last_alerted_discount: discountPercent,
                  last_alerted_price: Number(deal.price),
                  alert_count_this_week: decision.currentWeekCount,
                  alert_week_start: decision.isNewWeek ? now.toISOString() : game.alert_week_start,
                },
                'return=minimal'
              ).catch((err) => console.error('Error updating saved game alert state:', err.message))
            }
          }
        }
      } else if (!DRY_RUN && game.last_alerted_at && (!deal || Number(deal.cut) < 15)) {
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
