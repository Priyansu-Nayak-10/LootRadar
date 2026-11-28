import {
  shouldSendWishlistAlert,
  isConsoleGame,
  isAlertDue,
} from '../src/lib/wishlistAlerts.js'
import {
  bestDeal,
  createItadClient,
  fetchPrices,
  resolveItadId,
  shouldAlert,
} from './lib/itad.mjs'
import {
  buildSentAlertKeySet,
  buildWindowsFromSnapshots,
  createRateLimiter,
  formatFreeGameMessage,
  formatWishlistDealMessage,
  hasAlreadySentAlert,
  maskUserId,
  normalizeTitle,
  resolveWindowStart,
  sendWithRetries,
  shouldSkipMidWindowForRecentLateDayBefore,
} from './lib/telegramAlertHelpers.mjs'

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

const rateLimiter = createRateLimiter({ perChatMs: 1100, minGlobalGapMs: 50 })

async function rawTelegramPost(chatId, payload) {
  await rateLimiter.wait(chatId)
  const body = {
    chat_id: chatId,
    text: payload.text,
    disable_web_page_preview: true,
    ...(payload.replyMarkup ? { reply_markup: payload.replyMarkup } : {}),
  }
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (response.status === 429) {
    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    const headerRetry = response.headers?.get?.('Retry-After')
    const retryAfter = Number(data?.parameters?.retry_after ?? headerRetry ?? 2)
    return {
      status: 429,
      ok: false,
      retryAfter: Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : 2,
    }
  }

  if (response.status === 403) {
    return { status: 403, ok: false }
  }

  if (!response.ok) {
    return { status: response.status, ok: false }
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = { ok: true }
  }
  return { status: 200, ok: data?.ok !== false }
}

async function markConnectionInactive(chatId) {
  if (DRY_RUN) return
  await supabase(
    'PATCH',
    `telegram_connections?chat_id=eq.${encodeURIComponent(chatId)}`,
    { active: false, inactive_reason: 'Telegram 403: user blocked or deactivated bot' },
    'return=minimal'
  )
}

async function deliverTelegramMessage({ chatId, userId, kind, payload, dryRunLog, stats }) {
  if (DRY_RUN) {
    const maskedUser = maskUserId(userId)
    console.log(
      `[DRY_RUN] user=${maskedUser} kind=${kind} button=${payload.buttonLabel || 'none'} host=${payload.urlHost || 'none'}\n${payload.text}\n---`
    )
    dryRunLog.push({
      user: maskedUser,
      kind,
      button: payload.buttonLabel || '-',
      host: payload.urlHost || '-',
      preview: payload.text.split('\n')[0],
    })
    return { ok: true }
  }

  const res = await sendWithRetries({
    sendFn: rawTelegramPost,
    chatId,
    payload,
    on403: markConnectionInactive,
  })
  if (res.retried) stats.retried++
  if (res.givenUp) {
    stats.givenUp++
    console.warn(
      `[WARN] Gave up sending alert kind=${kind} user=${maskUserId(userId)}: ${res.reason || `status=${res.status}`}`
    )
  }
  return res
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
    const epic = await loadJson(new URL('../public/data/epic-free-games.json', import.meta.url))
    const gamerPower = await loadJson(
      new URL('../public/data/gamerpower-free-games.json', import.meta.url)
    )
    const windows = buildWindowsFromSnapshots({ epic, gamerPower, now })
    const dryRunLog = []
    const stats = { sent: 0, retried: 0, givenUp: 0 }
    const mockUserId = 'dry-run-user-0001'
    for (const window of windows) {
      const start = window.start_at ? new Date(window.start_at) : null
      const end = window.end_at ? new Date(window.end_at) : null
      const candidates = []
      if (start) {
        candidates.push({ kind: 'day_before', target: new Date(start.getTime() - 24 * 60 * 60 * 1000) })
        if (end) candidates.push({ kind: 'mid_window', target: new Date(start.getTime() + (end.getTime() - start.getTime()) / 2) })
      }
      if (end) {
        candidates.push({ kind: 'ending_soon', target: new Date(end.getTime() - 6 * 60 * 60 * 1000) })
      }
      for (const candidate of candidates) {
        if (!isAlertDue({ kind: candidate.kind, target: candidate.target, end, candidates, now })) continue
        const payload = formatFreeGameMessage({ kind: candidate.kind, window, now })
        await deliverTelegramMessage({
          chatId: 'dry-run-chat',
          userId: mockUserId,
          kind: candidate.kind,
          payload,
          dryRunLog,
          stats,
        })
        stats.sent++
      }
    }
    if (dryRunLog.length > 0) console.table(dryRunLog)
    console.log(`DRY_RUN_SUMMARY windows=${windows.length} wouldSend=${stats.sent} retried=${stats.retried} givenUp=${stats.givenUp}`)
    const idCache = new Map()
    const { summary } = await evaluateItadForTitles(SAMPLE_DRY_RUN_TITLES, idCache, now)
    if (summary.length > 0) console.table(summary)
    return
  }

  console.log('SENDER_PHASE=loading_snapshots')
  const epic = await loadJson(new URL('../public/data/epic-free-games.json', import.meta.url))
  const gamerPower = await loadJson(
    new URL('../public/data/gamerpower-free-games.json', import.meta.url)
  )

  const windows = buildWindowsFromSnapshots({ epic, gamerPower, now })
  const dbWindows = windows.map((w) => ({
    game_key: w.game_key,
    title: w.title,
    normalized_title: w.normalized_title,
    platform: w.platform,
    source: w.source,
    start_at: w.start_at,
    end_at: w.end_at,
    link: w.link,
    image: w.image,
    updated_at: w.updated_at,
  }))

  if (!DRY_RUN && dbWindows.length > 0) {
    console.log('SENDER_PHASE=upserting_free_game_windows')
    await supabase(
      'POST',
      'free_game_windows?on_conflict=game_key',
      dbWindows,
      'resolution=merge-duplicates,return=minimal'
    )
  }

  const dryRunLog = []
  const deliveryStats = { sent: 0, retried: 0, givenUp: 0 }

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
  const sentKeys = buildSentAlertKeySet(sentAlerts)

  const sentInRun = new Set()

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
        if (!isAlertDue({
          kind: candidate.kind,
          target: candidate.target,
          end,
          candidates: candidateAlerts,
          now,
        })) continue

        const runKey = `${setting.user_id}|${window.dedupe_key}|${candidate.kind}`
        if (sentInRun.has(runKey)) continue

        const windowStart = resolveWindowStart(window)
        if (hasAlreadySentAlert({
          sentKeys,
          userId: setting.user_id,
          window,
          windowStart,
          alertKind: candidate.kind,
        })) continue

        if (
          candidate.kind === 'mid_window' &&
          shouldSkipMidWindowForRecentLateDayBefore({
            sentAlerts,
            userId: setting.user_id,
            window,
            windowStart,
            now,
          })
        ) {
          continue
        }

        const payload = formatFreeGameMessage({ kind: candidate.kind, window, now })
        const result = await deliverTelegramMessage({
          chatId: connection.chat_id,
          userId: setting.user_id,
          kind: candidate.kind,
          payload,
          dryRunLog,
          stats: deliveryStats,
        })
        if (!result.ok) continue

        deliveryStats.sent++
        sentInRun.add(runKey)
        const sentKey = `${setting.user_id}|${window.game_key}|${windowStart}|${candidate.kind}`
        if (!DRY_RUN) {
          try {
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
          } catch (err) {
            if (String(err?.message || '').includes('23505')) {
              console.warn(
                `[WARN] Duplicate sent_alerts row skipped (23505) user=${maskUserId(setting.user_id)} kind=${candidate.kind}`
              )
            } else {
              throw err
            }
          }
        }
        sentKeys.add(sentKey)
        sentAlerts.push({
          user_id: setting.user_id,
          game_key: window.game_key,
          window_start: windowStart,
          alert_kind: candidate.kind,
          sent_at: now.toISOString(),
        })
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
          const payload = formatWishlistDealMessage({
            title: game.title,
            deal,
            discountPercent,
            formatInr,
          })

          const result = await deliverTelegramMessage({
            chatId: connection.chat_id,
            userId: setting.user_id,
            kind: 'wishlist_deal',
            payload,
            dryRunLog,
            stats: deliveryStats,
          })
          if (result.ok) {
            deliveryStats.sent++
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

  if (DRY_RUN && dryRunLog.length > 0) {
    console.table(dryRunLog)
  }
  console.log(
    `Processed wishlist deals, sent=${deliveryStats.sent} wishlistAlerts=${wishlistAlertsSent} retried=${deliveryStats.retried} givenUp=${deliveryStats.givenUp}`
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
