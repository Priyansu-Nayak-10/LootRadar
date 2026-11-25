/**
 * Shared helpers for Free Games (giveaways, countdowns, filtering, deduplication).
 * Used by FreeNow page, Home free games carousel/panels, and alert routines.
 */

const CLEAN_TITLE_PATTERNS = [
  /\s*\((?:Epic Games Store|Epic Games|Epic|Steam|GOG|itch\.io|Itch\.io|IndieGala|Amazon|Prime|EA Store|Mobile)\)/gi,
  /\s*\[(?:Epic Games Store|Epic Games|Epic|Steam|GOG|itch\.io|Itch\.io|IndieGala|Amazon|Prime|EA Store|Mobile)\]/gi,
  /\s*(?:-\s*)?Giveaway\b/gi,
  /\s*(?:-\s*)?Free Games? Bundle\b/gi,
  /\s*(?:-\s*)?Free Steam Key\b/gi,
  /\s*(?:-\s*)?Key Giveaway\b/gi,
]

export function cleanTitle(title) {
  if (!title || typeof title !== 'string') return ''
  let cleaned = title.trim()

  for (const pattern of CLEAN_TITLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = cleaned.replace(/[\s\-_:–—()]+$/, '').trim()
  return cleaned || title.trim()
}

export function isMobile(item) {
  if (!item || typeof item !== 'object') return false
  const platforms = String(item.platforms || item.platform || '').toLowerCase()
  const title = String(item.title || '').toLowerCase()
  return /(android|ios|mobile|iphone|ipad)/i.test(`${platforms} ${title}`)
}

export function normalizeStore(item) {
  if (!item || typeof item !== 'object') return 'Other'
  const haystack = [
    item.platforms,
    item.platform,
    item.store,
    item.shop?.name,
    item.title,
    item.open_giveaway_url,
    item.gamerpower_url,
    item.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('epic')) return 'Epic'
  if (haystack.includes('steam')) return 'Steam'
  if (haystack.includes('ea store') || haystack.includes('origin')) return 'EA Store'
  if (haystack.includes('gog')) return 'GOG'
  if (haystack.includes('itch')) return 'itch.io'
  if (haystack.includes('amazon') || haystack.includes('prime')) return 'Prime/Amazon'
  if (haystack.includes('ubisoft') || haystack.includes('uplay')) return 'Ubisoft'

  return 'Other'
}

export function parseEndDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return null
  if (typeof dateStr === 'number') return Number.isNaN(dateStr) ? null : dateStr
  const clean = dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`
  const t = new Date(clean).getTime()
  return Number.isNaN(t) ? null : t
}

export function isActive(item, now = Date.now()) {
  if (!item || typeof item !== 'object') return false
  if (item.status && /expired|ended/i.test(item.status)) return false

  const endMs = parseEndDate(item.end_date || item.endDate || item.expiry)
  if (endMs == null) return true

  return endMs > now
}

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

export function parseWorthUsd(worth) {
  if (worth == null) return 0
  if (typeof worth === 'number') return Number.isNaN(worth) ? 0 : worth
  const match = String(worth).match(/[\d.]+/)
  return match ? parseFloat(match[0]) || 0 : 0
}

const INR_WHOLE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const INR_PAISE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatWorthInr(amount) {
  const val = Number(amount)
  if (!Number.isFinite(val) || val <= 0) return ''
  const hasPaise = Math.abs(val - Math.trunc(val)) > 0.001
  return hasPaise ? INR_PAISE_FORMATTER.format(val) : INR_WHOLE_FORMATTER.format(val)
}

export function normalizeItadFreeItem(item) {
  if (!item || typeof item !== 'object') return null
  const shopName = item.shop?.name || ''
  const steamUrl = item.steamAppId ? `https://store.steampowered.com/app/${item.steamAppId}` : ''
  const steamImage = item.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/header.jpg`
    : ''
  const image = item.image || steamImage || ''
  const regular = Number(item.regular || 0)

  return {
    id: item.itadId || item.id,
    title: cleanTitle(item.title),
    platforms: shopName ? `PC, ${shopName}` : 'PC',
    store: shopName,
    image,
    thumbnail: image,
    end_date: item.expiry || null,
    endDate: item.expiry || null,
    steamAppId: item.steamAppId || null,
    worthInr: regular > 0 ? regular : 0,
    open_giveaway_url: steamUrl || item.url || '',
    url: item.url || '',
    _isItad: true,
  }
}

function getOfficialClaimUrl(item) {
  if (!item || typeof item !== 'object') return ''
  if (item.slug && !/^[0-9a-f-]{30,}$/i.test(item.slug) && (item.namespace || (item.image && item.image.includes('epicgames.com')))) {
    return `https://store.epicgames.com/p/${item.slug}`
  }
  if (item.steamAppId) {
    return `https://store.steampowered.com/app/${item.steamAppId}`
  }
  return ''
}

function pickBestClaimUrl(existing, item) {
  const officialItem = getOfficialClaimUrl(item)
  if (officialItem) return officialItem
  const officialExisting = getOfficialClaimUrl(existing)
  if (officialExisting) return officialExisting

  return (
    item.open_giveaway_url ||
    existing.open_giveaway_url ||
    item.url ||
    existing.url ||
    existing.gamerpower_url ||
    item.gamerpower_url ||
    ''
  )
}

export function dedupe(items = []) {
  if (!Array.isArray(items)) return []

  const map = new Map()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const title = cleanTitle(item.title)
    if (!title) continue
    const key = title.toLowerCase()

    if (!map.has(key)) {
      const officialUrl = getOfficialClaimUrl(item)
      const worthInr = Number(item.worthInr || (item._isItad ? item.regular : 0) || 0)
      map.set(key, {
        ...item,
        title,
        worthInr,
        open_giveaway_url: officialUrl || item.open_giveaway_url || item.url || item.gamerpower_url || '',
      })
      continue
    }

    const existing = map.get(key)
    const isItemEpic = Boolean(item.namespace || item.slug || (item.image && item.image.includes('epicgames.com')))
    const isExistingEpic = Boolean(existing.namespace || existing.slug || (existing.image && existing.image.includes('epicgames.com')))

    // Earliest non-null end time
    const existingEnd = parseEndDate(existing.end_date || existing.endDate || existing.expiry)
    const itemEnd = parseEndDate(item.end_date || item.endDate || item.expiry)
    let bestEnd = existing.end_date || existing.endDate || existing.expiry || null
    if (itemEnd != null && (existingEnd == null || itemEnd < existingEnd)) {
      bestEnd = item.end_date || item.endDate || item.expiry
    }

    // Best image: Epic official > ITAD/Steam > GamerPower
    const bestImage =
      (isItemEpic && item.image) ||
      (isExistingEpic && existing.image) ||
      existing.image ||
      item.image ||
      existing.thumbnail ||
      item.thumbnail ||
      ''

    const bestUrl = pickBestClaimUrl(existing, item)

    // Worth in INR ONLY from ITAD (never USD fallback)
    const itemWorthInr = Number(item.worthInr || (item._isItad ? item.regular : 0) || 0)
    const existingWorthInr = Number(existing.worthInr || 0)
    const bestWorthInr = itemWorthInr > 0 ? itemWorthInr : existingWorthInr

    // Merge metadata preferring Epic details when available
    const base = isItemEpic && !isExistingEpic ? { ...existing, ...item } : { ...item, ...existing }

    map.set(key, {
      ...base,
      title,
      image: bestImage,
      thumbnail: bestImage,
      open_giveaway_url: bestUrl,
      worthInr: bestWorthInr,
      steamAppId: existing.steamAppId || item.steamAppId || null,
      end_date: bestEnd,
      endDate: bestEnd,
    })
  }

  return Array.from(map.values())
}

export function mergeFreeSources({
  epicItems = [],
  gamerPowerItems = [],
  itadFreeItems = [],
  now = Date.now(),
} = {}) {
  const normalizedItad = (Array.isArray(itadFreeItems) ? itadFreeItems : [])
    .map(normalizeItadFreeItem)
    .filter(Boolean)

  const combined = dedupe([
    ...(Array.isArray(gamerPowerItems) ? gamerPowerItems : []),
    ...(Array.isArray(epicItems) ? epicItems : []),
    ...normalizedItad,
  ])

  const filtered = combined.filter((item) => !isMobile(item) && isActive(item, now))
  return sortFreeGames(filtered, 'ending', now)
}

export function sortFreeGames(items = [], sortKey = 'ending', now = Date.now()) {
  const list = [...items]

  if (sortKey === 'value') {
    return list.sort((a, b) => Number(b.worthInr || 0) - Number(a.worthInr || 0))
  }

  if (sortKey === 'recent') {
    return list.sort((a, b) => {
      const idA = Number(a.id) || 0
      const idB = Number(b.id) || 0
      return idB - idA
    })
  }

  return list.sort((a, b) => {
    const endA = parseEndDate(a.end_date || a.endDate || a.expiry)
    const endB = parseEndDate(b.end_date || b.endDate || b.expiry)
    const valA = endA != null && endA > now ? endA : Infinity
    const valB = endB != null && endB > now ? endB : Infinity
    return valA - valB
  })
}

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

export function serializeFreeParams({ tab = 'claim', store = 'all', sort = 'ending' } = {}) {
  const params = new URLSearchParams()
  if (tab && tab !== 'claim') params.set('tab', tab)
  if (store && store !== 'all') params.set('store', store)
  if (sort && sort !== 'ending') params.set('sort', sort)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
