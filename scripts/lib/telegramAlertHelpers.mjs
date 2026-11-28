import { cleanTitle, dedupeKey, isMobile } from '../../src/lib/freeGames.js'

export function parseUtc(value) {
  if (!value || value === 'N/A') return null
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('T') ? '' : 'Z'))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

export function istLabel(value) {
  if (!value) return 'time TBA'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function computeHoursLeft(endAt, now = new Date()) {
  if (!endAt) return 1
  const endMs = endAt instanceof Date ? endAt.getTime() : new Date(endAt).getTime()
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (Number.isNaN(endMs) || Number.isNaN(nowMs)) return 1
  return Math.max(1, Math.ceil((endMs - nowMs) / 3600000))
}

export function getUrlHost(url) {
  if (!url || typeof url !== 'string') return ''
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

export function maskUserId(userId = '') {
  const s = String(userId || '')
  if (s.length <= 8) return s ? `${s.slice(0, 2)}***` : '***'
  return `${s.slice(0, 4)}***${s.slice(-4)}`
}

export function buildWindowsFromSnapshots({ epic = {}, gamerPower = {}, now = new Date() } = {}) {
  const mergedByKey = new Map()
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString()

  const addOrMerge = (incoming) => {
    const key = incoming.dedupe_key
    if (!key) return
    const existing = mergedByKey.get(key)
    if (!existing) {
      mergedByKey.set(key, {
        ...incoming,
        legacy_keys: incoming.legacy_game_key ? [incoming.legacy_game_key] : [],
      })
      return
    }

    const legacyKeys = new Set(existing.legacy_keys)
    if (incoming.legacy_game_key) legacyKeys.add(incoming.legacy_game_key)

    // Prefer Epic window (it has start_at and end_at); fill missing fields from GamerPower
    const existingIsEpic = existing.source === 'Epic Games Store'
    const incomingIsEpic = incoming.source === 'Epic Games Store'

    if (!existingIsEpic && incomingIsEpic) {
      mergedByKey.set(key, {
        ...incoming,
        link: incoming.link || existing.link,
        platform: incoming.platform || existing.platform,
        image: incoming.image || existing.image,
        legacy_keys: [...legacyKeys],
      })
    } else {
      mergedByKey.set(key, {
        ...existing,
        link: existing.link || incoming.link,
        platform: existing.platform || incoming.platform,
        image: existing.image || incoming.image,
        legacy_keys: [...legacyKeys],
      })
    }
  }

  for (const game of [...(epic.current || []), ...(epic.upcoming || [])]) {
    const title = cleanTitle(game?.title)
    const dKey = dedupeKey(title)
    if (!title || !dKey) continue
    addOrMerge({
      dedupe_key: dKey,
      game_key: `title:${dKey}`,
      legacy_game_key: `epic:${game.id}:${game.startDate}:${game.endDate}`,
      title,
      normalized_title: normalizeTitle(title),
      platform: 'Epic',
      source: 'Epic Games Store',
      start_at: game.startDate || null,
      end_at: game.endDate || null,
      link: game.slug ? `https://store.epicgames.com/en-US/p/${game.slug}` : '',
      image: game.image || '',
      updated_at: nowIso,
    })
  }

  for (const game of gamerPower.games || []) {
    if (!game || typeof game !== 'object') continue
    if (isMobile(game)) continue
    if (String(game.type || '').trim().toLowerCase() !== 'game') continue

    const title = cleanTitle(game.title)
    const dKey = dedupeKey(title)
    if (!title || !dKey) continue

    const end = parseUtc(game.end_date)
    addOrMerge({
      dedupe_key: dKey,
      game_key: `title:${dKey}`,
      legacy_game_key: `gamerpower:${game.id}:${end || 'unknown'}`,
      title,
      normalized_title: normalizeTitle(title),
      platform: game.platforms || 'PC',
      source: 'GamerPower',
      start_at: null,
      end_at: end,
      link: game.open_giveaway_url || game.gamerpower_url || 'https://www.gamerpower.com',
      image: game.thumbnail || '',
      updated_at: nowIso,
    })
  }

  return [...mergedByKey.values()]
}

export function normalizeWindowStart(value) {
  if (!value) return '1970-01-01T00:00:00.000Z'
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? '1970-01-01T00:00:00.000Z' : new Date(ms).toISOString()
}

export function resolveWindowStart(window) {
  if (window?.start_at) return normalizeWindowStart(window.start_at)
  if (window?.end_at) return normalizeWindowStart(window.end_at)
  return '1970-01-01T00:00:00.000Z'
}

export function buildSentAlertKeySet(sentAlerts = []) {
  const set = new Set()
  for (const alert of sentAlerts || []) {
    if (!alert) continue
    const ws = normalizeWindowStart(alert.window_start)
    set.add(`${alert.user_id}|${alert.game_key}|${ws}|${alert.alert_kind}`)
  }
  return set
}

export function hasAlreadySentAlert({ sentKeys, userId, window, windowStart, alertKind }) {
  if (!sentKeys || !window) return false
  const ws = normalizeWindowStart(windowStart)
  if (sentKeys.has(`${userId}|${window.game_key}|${ws}|${alertKind}`)) {
    return true
  }
  for (const legacyKey of window.legacy_keys || []) {
    if (sentKeys.has(`${userId}|${legacyKey}|${ws}|${alertKind}`)) {
      return true
    }
  }
  return false
}

export function shouldSkipMidWindowForRecentLateDayBefore({
  sentAlerts = [],
  userId,
  window,
  windowStart,
  now = new Date(),
  withinHours = 12,
}) {
  if (!window?.start_at) return false
  const startMs = new Date(window.start_at).getTime()
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return false

  const ws = normalizeWindowStart(windowStart)
  const validKeys = new Set([window.game_key, ...(window.legacy_keys || [])])
  const withinMs = withinHours * 60 * 60 * 1000

  for (const alert of sentAlerts || []) {
    if (!alert || alert.user_id !== userId || alert.alert_kind !== 'day_before') continue
    if (!validKeys.has(alert.game_key)) continue
    if (normalizeWindowStart(alert.window_start) !== ws) continue
    const sentAtMs = alert.sent_at ? new Date(alert.sent_at).getTime() : NaN
    if (Number.isNaN(sentAtMs)) continue
    // Late day_before (sent after start_at) within the previous 12 hours
    if (sentAtMs >= startMs && nowMs - sentAtMs >= 0 && nowMs - sentAtMs < withinMs) {
      return true
    }
  }
  return false
}

export function formatFreeGameMessage({ kind, window, now = new Date() }) {
  const store = window.platform || 'PC'
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const startMs = window.start_at ? new Date(window.start_at).getTime() : NaN
  const isLateDayBefore = kind === 'day_before' && !Number.isNaN(startMs) && !Number.isNaN(nowMs) && nowMs >= startMs

  let text
  let buttonLabel

  if (kind === 'day_before' && !isLateDayBefore) {
    text = [
      `🎁 Free tomorrow: ${window.title}`,
      `Starts: ${istLabel(window.start_at)}`,
      `Store: ${store}`,
    ].join('\n')
    buttonLabel = 'Open store page'
  } else if (kind === 'mid_window' || isLateDayBefore) {
    text = [
      `🎮 Free right now: ${window.title}`,
      `Ends: ${istLabel(window.end_at)}`,
      `Store: ${store}`,
    ].join('\n')
    buttonLabel = 'Claim now'
  } else {
    const hoursLeft = computeHoursLeft(window.end_at, now)
    text = [
      `⏰ Ends in about ${hoursLeft} hours: ${window.title}`,
      `Ends: ${istLabel(window.end_at)}`,
      `Store: ${store}`,
    ].join('\n')
    buttonLabel = 'Claim now'
  }

  const link = window.link && String(window.link).trim() ? String(window.link).trim() : null
  const replyMarkup = link
    ? { inline_keyboard: [[{ text: buttonLabel, url: link }]] }
    : undefined

  return {
    text,
    replyMarkup,
    buttonLabel: link ? buttonLabel : null,
    urlHost: getUrlHost(link),
  }
}

export function formatWishlistDealMessage({ title, deal, discountPercent, formatInr }) {
  const lines = [
    `🎯 Wishlist Deal Alert: ${title}`,
    `Store: ${deal.store || 'PC Store'}`,
    `Price: ${formatInr(deal.price)} (was ${formatInr(deal.regular)}, -${discountPercent}%)`,
  ]
  if (deal.historyLow != null) {
    lines.push(`Lowest ever: ${formatInr(deal.historyLow)}`)
  }
  if (deal.expiry) {
    lines.push(`Ends: ${istLabel(deal.expiry)}`)
  }

  const link = deal.url && String(deal.url).trim() ? String(deal.url).trim() : null
  const buttonLabel = 'View deal'
  const replyMarkup = link
    ? { inline_keyboard: [[{ text: buttonLabel, url: link }]] }
    : undefined

  return {
    text: lines.join('\n'),
    replyMarkup,
    buttonLabel: link ? buttonLabel : null,
    urlHost: getUrlHost(link),
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createRateLimiter({
  perChatMs = 1100,
  minGlobalGapMs = 50,
  sleep = defaultSleep,
  now = () => Date.now(),
} = {}) {
  const lastByChat = new Map()
  let lastGlobal = 0

  return {
    async wait(chatId) {
      const key = String(chatId)
      const current = now()
      const chatLast = lastByChat.get(key) || 0
      const chatWait = chatLast > 0 ? Math.max(0, perChatMs - (current - chatLast)) : 0
      const globalWait = lastGlobal > 0 ? Math.max(0, minGlobalGapMs - (current - lastGlobal)) : 0
      const waitMs = Math.max(chatWait, globalWait)
      if (waitMs > 0) {
        await sleep(waitMs)
      }
      const sentAt = now()
      lastByChat.set(key, sentAt)
      lastGlobal = sentAt
      return waitMs
    },
  }
}

export async function sendWithRetries({
  sendFn,
  chatId,
  payload,
  sleep = defaultSleep,
  on403,
}) {
  const TEMP_RETRY_DELAYS_MS = [2000, 5000]
  let tempRetries = 0
  let rateLimitAttempts = 0
  let retried = false

  while (true) {
    try {
      const res = await sendFn(chatId, payload)

      if (res.status === 200 && res.ok !== false) {
        return { ok: true, status: 200, retried, givenUp: false }
      }

      if (res.status === 403) {
        if (on403) await on403(chatId)
        return { ok: false, status: 403, retried, givenUp: false }
      }

      if (res.status === 429) {
        rateLimitAttempts++
        if (rateLimitAttempts >= 3) {
          return { ok: false, status: 429, retried, givenUp: true, reason: '429 max attempts reached' }
        }
        retried = true
        const retryAfterSec = Number(res.retryAfter)
        const waitSec = Number.isFinite(retryAfterSec) && retryAfterSec >= 0 ? retryAfterSec : 2
        await sleep((waitSec + 1) * 1000)
        continue
      }

      if (res.status >= 500) {
        if (tempRetries < TEMP_RETRY_DELAYS_MS.length) {
          retried = true
          await sleep(TEMP_RETRY_DELAYS_MS[tempRetries])
          tempRetries++
          continue
        }
        return { ok: false, status: res.status, retried, givenUp: true, reason: `HTTP ${res.status}` }
      }

      return { ok: false, status: res.status, retried, givenUp: true, reason: `HTTP ${res.status}` }
    } catch (err) {
      if (tempRetries < TEMP_RETRY_DELAYS_MS.length) {
        retried = true
        await sleep(TEMP_RETRY_DELAYS_MS[tempRetries])
        tempRetries++
        continue
      }
      return {
        ok: false,
        status: 0,
        retried,
        givenUp: true,
        reason: err?.message || 'Network error',
      }
    }
  }
}
