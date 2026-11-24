/**
 * Shared helpers for Free Games (giveaways, countdowns, filtering, deduplication).
 * Used by FreeNow page, Home free games carousel/panels, and alert routines.
 */

// Suffixes and tags commonly attached to giveaway titles
const CLEAN_TITLE_PATTERNS = [
  /\s*\((?:Epic Games Store|Epic Games|Epic|Steam|GOG|itch\.io|Itch\.io|IndieGala|Amazon|Prime|Mobile)\)/gi,
  /\s*\[(?:Epic Games Store|Epic Games|Epic|Steam|GOG|itch\.io|Itch\.io|IndieGala|Amazon|Prime|Mobile)\]/gi,
  /\s*(?:-\s*)?Giveaway\b/gi,
  /\s*(?:-\s*)?Free Games? Bundle\b/gi,
  /\s*(?:-\s*)?Free Steam Key\b/gi,
  /\s*(?:-\s*)?Key Giveaway\b/gi,
]

/**
 * Strips store tags, "(Mobile)", "Giveaway" and other extraneous suffixes from titles.
 * @param {string} title
 * @returns {string}
 */
export function cleanTitle(title) {
  if (!title || typeof title !== 'string') return ''
  let cleaned = title.trim()

  for (const pattern of CLEAN_TITLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Remove any dangling hyphens, colons, or parentheses at the end
  cleaned = cleaned.replace(/[\s\-_:–—()]+$/, '').trim()
  return cleaned || title.trim()
}

/**
 * Returns true if the giveaway item targets mobile platforms (Android/iOS).
 * Mobile giveaways must be excluded across Free Now, Home, and alerts.
 * @param {object} item
 * @returns {boolean}
 */
export function isMobile(item) {
  if (!item || typeof item !== 'object') return false
  const platforms = String(item.platforms || item.platform || '').toLowerCase()
  const title = String(item.title || '').toLowerCase()
  return /(android|ios|mobile|iphone|ipad)/i.test(`${platforms} ${title}`)
}

/**
 * Normalizes store name into:
 * 'Epic' | 'Steam' | 'GOG' | 'itch.io' | 'Prime/Amazon' | 'Ubisoft' | 'Other'
 * @param {object} item
 * @returns {string}
 */
export function normalizeStore(item) {
  if (!item || typeof item !== 'object') return 'Other'
  const haystack = [
    item.platforms,
    item.platform,
    item.store,
    item.title,
    item.open_giveaway_url,
    item.gamerpower_url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('epic')) return 'Epic'
  if (haystack.includes('steam')) return 'Steam'
  if (haystack.includes('gog')) return 'GOG'
  if (haystack.includes('itch')) return 'itch.io'
  if (haystack.includes('amazon') || haystack.includes('prime')) return 'Prime/Amazon'
  if (haystack.includes('ubisoft') || haystack.includes('uplay')) return 'Ubisoft'

  return 'Other'
}

/**
 * Parses end date string into Unix millisecond timestamp.
 * Handles GamerPower ("YYYY-MM-DD HH:mm:ss") and ISO 8601 strings.
 * @param {string|number|null} dateStr
 * @returns {number|null}
 */
export function parseEndDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return null
  if (typeof dateStr === 'number') return Number.isNaN(dateStr) ? null : dateStr
  const clean = dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`
  const t = new Date(clean).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Checks if a giveaway item is currently active (not expired).
 * Items without an end date are considered "open-ended" and active.
 * @param {object} item
 * @param {number} now
 * @returns {boolean}
 */
export function isActive(item, now = Date.now()) {
  if (!item || typeof item !== 'object') return false
  if (item.status && /expired|ended/i.test(item.status)) return false

  const endMs = parseEndDate(item.end_date || item.endDate)
  if (endMs == null) return true // open-ended

  return endMs > now
}

/**
 * Returns formatted countdown object for a giveaway.
 * - Under 12h: "Ends today" (urgent: true, isEndsToday: true)
 * - Under 24h: "Xh left" (urgent: true)
 * - 24h+: "Xd Yh left" (urgent: false)
 * - Open-ended (no date): "Time TBA" (urgent: false, isTba: true)
 * - Expired: "Ended" (urgent: true)
 *
 * @param {string|number|null} endDate
 * @param {number} now
 * @returns {{ text: string, urgent: boolean, isEndsToday: boolean, isTba: boolean }}
 */
export function formatTimeLeft(endDate, now = Date.now()) {
  const endMs = parseEndDate(endDate)
  if (endMs == null) {
    return { text: 'Time TBA', urgent: false, isEndsToday: false, isTba: true }
  }

  const diff = endMs - now
  if (diff <= 0) {
    return { text: 'Ended', urgent: true, isEndsToday: false, isTba: false }
  }

  const hoursTotal = Math.floor(diff / 3600000)
  if (hoursTotal < 12) {
    return { text: 'Ends today', urgent: true, isEndsToday: true, isTba: false }
  }

  if (hoursTotal < 24) {
    return { text: `${hoursTotal}h left`, urgent: true, isEndsToday: false, isTba: false }
  }

  const days = Math.floor(diff / 86400000)
  const remHours = Math.floor((diff % 86400000) / 3600000)
  return {
    text: `${days}d ${remHours}h left`,
    urgent: false,
    isEndsToday: false,
    isTba: false,
  }
}

/**
 * Formats "Starts in Xd Yh" for Upcoming / Coming Soon games.
 * @param {string|number} startDate
 * @param {number} now
 * @returns {string}
 */
export function formatStartsIn(startDate, now = Date.now()) {
  if (!startDate) return 'Coming soon'
  const startMs = parseEndDate(startDate)
  if (!startMs) return 'Coming soon'
  const diff = startMs - now
  if (diff <= 0) return 'Starting soon'

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)

  if (days > 0) return `Starts in ${days}d ${hours}h`
  if (hours > 0) return `Starts in ${hours}h`
  return 'Starts in <1h'
}

/**
 * Parses numeric USD value from a worth string like "$19.99 USD" or 19.99.
 * @param {string|number} worth
 * @returns {number}
 */
export function parseWorthUsd(worth) {
  if (worth == null) return 0
  if (typeof worth === 'number') return Number.isNaN(worth) ? 0 : worth
  const match = String(worth).match(/[\d.]+/)
  return match ? parseFloat(match[0]) || 0 : 0
}

/**
 * Deduplicates giveaway items by cleaned title.
 * Merges duplicate entries (e.g. GamerPower vs Epic official snapshot),
 * prioritizing Epic official links and artwork while keeping earliest end time.
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function dedupe(items = []) {
  if (!Array.isArray(items)) return []

  const map = new Map()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const title = cleanTitle(item.title)
    if (!title) continue
    const key = title.toLowerCase()

    if (!map.has(key)) {
      map.set(key, { ...item, title })
      continue
    }

    const existing = map.get(key)
    const isItemEpic = Boolean(item.namespace || item.slug || (item.image && item.image.includes('epicgames.com')))
    const isExistingEpic = Boolean(existing.namespace || existing.slug || (existing.image && existing.image.includes('epicgames.com')))

    // Earliest end time
    const existingEnd = parseEndDate(existing.end_date || existing.endDate)
    const itemEnd = parseEndDate(item.end_date || item.endDate)
    let bestEnd = existing.end_date || existing.endDate
    if (itemEnd != null && (existingEnd == null || itemEnd < existingEnd)) {
      bestEnd = item.end_date || item.endDate
    }

    // Best image
    const bestImage =
      (isItemEpic && item.image) ||
      existing.image ||
      existing.thumbnail ||
      item.image ||
      item.thumbnail ||
      ''

    // Best claim / open URL
    const bestUrl =
      item.open_giveaway_url ||
      existing.open_giveaway_url ||
      (item.slug ? `https://store.epicgames.com/p/${item.slug}` : '') ||
      existing.gamerpower_url ||
      item.gamerpower_url ||
      ''

    // Best worth
    const bestWorth = existing.worth || item.worth || ''

    if (isItemEpic && !isExistingEpic) {
      map.set(key, {
        ...existing,
        ...item,
        title,
        image: bestImage,
        thumbnail: bestImage,
        open_giveaway_url: bestUrl,
        worth: bestWorth,
        end_date: bestEnd,
        endDate: bestEnd,
      })
    } else {
      map.set(key, {
        ...existing,
        title,
        image: bestImage,
        thumbnail: bestImage,
        open_giveaway_url: bestUrl,
        worth: bestWorth,
        end_date: bestEnd,
        endDate: bestEnd,
      })
    }
  }

  return Array.from(map.values())
}

/**
 * Sorts giveaway items by:
 * - 'ending': Ending soonest first; open-ended (TBA) at the end.
 * - 'value': Highest worth value first.
 * - 'recent': Recently added first (by id descending or published_date).
 *
 * @param {Array<object>} items
 * @param {'ending'|'value'|'recent'} sortKey
 * @param {number} now
 * @returns {Array<object>}
 */
export function sortFreeGames(items = [], sortKey = 'ending', now = Date.now()) {
  const list = [...items]

  if (sortKey === 'value') {
    return list.sort((a, b) => parseWorthUsd(b.worth) - parseWorthUsd(a.worth))
  }

  if (sortKey === 'recent') {
    return list.sort((a, b) => {
      const idA = Number(a.id) || 0
      const idB = Number(b.id) || 0
      return idB - idA
    })
  }

  // Default: 'ending'
  return list.sort((a, b) => {
    const endA = parseEndDate(a.end_date || a.endDate)
    const endB = parseEndDate(b.end_date || b.endDate)
    const valA = endA != null && endA > now ? endA : Infinity
    const valB = endB != null && endB > now ? endB : Infinity
    return valA - valB
  })
}

/**
 * Parses free page URL search params into clean state.
 * @param {string} search
 * @returns {{ tab: 'claim'|'coming'|'always', store: string, sort: 'ending'|'value'|'recent' }}
 */
export function parseFreeParams(search = '') {
  const query = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(query)

  const rawTab = (params.get('tab') || 'claim').toLowerCase()
  const tab = ['claim', 'coming', 'always'].includes(rawTab) ? rawTab : 'claim'

  const rawStore = (params.get('store') || 'all').toLowerCase()
  const store = rawStore || 'all'

  const rawSort = (params.get('sort') || 'ending').toLowerCase()
  const sort = ['ending', 'value', 'recent'].includes(rawSort) ? rawSort : 'ending'

  return { tab, store, sort }
}

/**
 * Serializes state back to URL query string.
 * @param {{ tab: string, store: string, sort: string }} state
 * @returns {string}
 */
export function serializeFreeParams({ tab = 'claim', store = 'all', sort = 'ending' } = {}) {
  const params = new URLSearchParams()
  if (tab && tab !== 'claim') params.set('tab', tab)
  if (store && store !== 'all') params.set('store', store)
  if (sort && sort !== 'ending') params.set('sort', sort)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
