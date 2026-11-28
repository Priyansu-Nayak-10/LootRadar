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
  if (item.isMobile) return true
  const platforms = String(item.platforms || item.platform || '').toLowerCase()
  const title = String(item.title || '').toLowerCase()
  return /(android|ios|mobile|iphone|ipad)/i.test(`${platforms} ${title}`)
}

export function normalizeStore(item) {
  if (!item || typeof item !== 'object') return 'Other'
  if (item.namespace || item.source === 'Epic Games Store' || item._isEpicOfficial) return 'Epic'
  if (item.source === 'Steam' || item.steamAppId) return 'Steam'
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
  if (haystack.includes('indiegala')) return 'IndieGala'
  if (haystack.includes('stove')) return 'STOVE'
  if (/\b(rift|oculus|meta|quest)\b/.test(haystack)) return 'Meta Quest'
  if (haystack.includes('amazon') || haystack.includes('prime')) return 'Prime/Amazon'
  if (haystack.includes('ubisoft') || haystack.includes('uplay')) return 'Ubisoft'

  return 'Other'
}

export function parseEndDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return null
  if (dateStr instanceof Date) {
    const t = dateStr.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof dateStr === 'number') return Number.isNaN(dateStr) ? null : dateStr
  if (typeof dateStr !== 'string') return null
  const clean = dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`
  const t = new Date(clean).getTime()
  return Number.isNaN(t) ? null : t
}

const SIX_HOURS_MS = 6 * 3600000
const FORTY_EIGHT_HOURS_MS = 48 * 3600000

export function getTimeTone(endDate, now = Date.now()) {
  const endMs = parseEndDate(endDate)
  if (endMs == null) return 'none'
  const diff = endMs - now
  if (diff > FORTY_EIGHT_HOURS_MS) return 'calm'
  if (diff >= SIX_HOURS_MS) return 'soon'
  return 'urgent'
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

const SAFE_ROMAN_NUMERALS = [
  [/\bviii\b/g, '8'],
  [/\bvii\b/g, '7'],
  [/\biii\b/g, '3'],
  [/\biv\b/g, '4'],
  [/\bix\b/g, '9'],
  [/\bvi\b/g, '6'],
  [/\bii\b/g, '2'],
]

/**
 * Dedupe key for free-game and coming-soon titles.
 * Preserves ambiguous single-letter numerals (i, v, x) and drops standalone
 * "part" only when immediately followed by a digit token.
 */
export function dedupeKey(title) {
  if (!title || typeof title !== 'string') return ''
  const plainNormalized = title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plainNormalized) return ''

  let normalized = plainNormalized
  for (const [pattern, digit] of SAFE_ROMAN_NUMERALS) {
    normalized = normalized.replace(pattern, digit)
  }
  normalized = normalized
    .replace(/\bpart\s+(?=\d+\b)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || plainNormalized
}

const ROMAN_NUMERALS = [
  [/\bviii\b/g, '8'],
  [/\bvii\b/g, '7'],
  [/\biii\b/g, '3'],
  [/\biv\b/g, '4'],
  [/\bix\b/g, '9'],
  [/\bvi\b/g, '6'],
  [/\bii\b/g, '2'],
  [/\bx\b/g, '10'],
  [/\bv\b/g, '5'],
  [/\bi\b/g, '1'],
]

/**
 * Merge-key function used ONLY for deduplicating free game entries.
 * Lowercase, strip accents and ™®, replace standalone roman numerals I to X with digits,
 * remove punctuation, drop "the", collapse spaces.
 * IMPORTANT: Does not modify the existing titleKey / normalized_title logic.
 */
export function freeGameMergeKey(title) {
  if (!title || typeof title !== 'string') return ''
  let cleaned = cleanTitle(title).toLowerCase()
  // Strip accents
  cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Strip trademarks and copyright symbols
  cleaned = cleaned.replace(/[™®©]/g, '')
  // Replace standalone roman numerals I to X with digits
  for (const [pattern, digit] of ROMAN_NUMERALS) {
    cleaned = cleaned.replace(pattern, digit)
  }
  // Remove punctuation (replace with spaces so words don't glue)
  cleaned = cleaned.replace(/[^\w\s]/g, ' ')
  // Drop standalone word "the"
  cleaned = cleaned.replace(/\bthe\b/g, ' ')
  // Collapse whitespace
  return cleaned.replace(/\s+/g, ' ').trim()
}

export function isOfficialStoreSource(item) {
  if (!item || typeof item !== 'object') return false
  if (item._isItad || item._isEpicOfficial) return true
  if (item.namespace || (item.slug && item.startDate)) return true
  if (item.source === 'Epic Games Store' || item.source === 'Steam' || item.source === 'GOG') return true
  if (item.steamAppId) return true

  const url = item.open_giveaway_url || item.url || ''
  if (
    url.includes('store.epicgames.com') ||
    url.includes('store.steampowered.com') ||
    url.includes('gog.com')
  ) {
    return true
  }
  return false
}

export function formatWorthInr(worth, usdToInrRate = null) {
  if (worth == null) return null

  if (typeof worth === 'object') {
    const currency = worth.currency || 'INR'
    if (currency === 'INR') {
      const val = Number(worth.amount)
      if (!Number.isFinite(val) || val <= 0) return null
      const hasPaise = Math.abs(val - Math.trunc(val)) > 0.001
      return hasPaise ? INR_PAISE_FORMATTER.format(val) : INR_WHOLE_FORMATTER.format(val)
    }
    if (currency === 'USD') {
      const usd = parseWorthUsd(worth.amount)
      if (usd <= 0 || !Number.isFinite(Number(usdToInrRate)) || Number(usdToInrRate) <= 0) return null
      const rawInr = usd * Number(usdToInrRate)
      const rounded = rawInr < 1000 ? Math.round(rawInr) : Math.round(rawInr / 5) * 5
      return rounded > 0 ? `≈ ${INR_WHOLE_FORMATTER.format(rounded)}` : null
    }
    return null
  }

  if (typeof worth === 'string') {
    const trimmed = worth.trim()
    if (!trimmed || /^n\/a$/i.test(trimmed)) return null
    const isUsdString = trimmed.includes('$') || /\busd\b/i.test(trimmed)
    if (!isUsdString) {
      const val = parseWorthUsd(trimmed)
      if (!Number.isFinite(val) || val <= 0) return null
      const hasPaise = Math.abs(val - Math.trunc(val)) > 0.001
      return hasPaise ? INR_PAISE_FORMATTER.format(val) : INR_WHOLE_FORMATTER.format(val)
    }
    const usd = parseWorthUsd(trimmed)
    if (usd <= 0 || !Number.isFinite(Number(usdToInrRate)) || Number(usdToInrRate) <= 0) return null
    const rawInr = usd * Number(usdToInrRate)
    const rounded = rawInr < 1000 ? Math.round(rawInr) : Math.round(rawInr / 5) * 5
    return rounded > 0 ? `≈ ${INR_WHOLE_FORMATTER.format(rounded)}` : null
  }

  if (typeof worth === 'number') {
    if (!Number.isFinite(worth) || worth <= 0) return null
    const hasPaise = Math.abs(worth - Math.trunc(worth)) > 0.001
    return hasPaise ? INR_PAISE_FORMATTER.format(worth) : INR_WHOLE_FORMATTER.format(worth)
  }

  return null
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

  const worth = regular > 0 ? {
    amount: regular,
    currency: 'INR',
    source: shopName || 'Epic Game Store',
  } : null

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
    worth,
    open_giveaway_url: steamUrl || item.url || '',
    url: item.url || '',
    type: item.type || 'Game',
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

function pickBestClaimUrl(chosen, dropped) {
  const officialChosen = getOfficialClaimUrl(chosen)
  if (officialChosen) return officialChosen
  const officialDropped = getOfficialClaimUrl(dropped)
  if (officialDropped) return officialDropped

  return (
    chosen.open_giveaway_url ||
    chosen.url ||
    chosen.gamerpower_url ||
    dropped.open_giveaway_url ||
    dropped.url ||
    dropped.gamerpower_url ||
    ''
  )
}

function pickNicerTitle(titleA, titleB) {
  if (!titleA) return titleB || ''
  if (!titleB) return titleA
  if (titleA.length !== titleB.length) {
    return titleA.length > titleB.length ? titleA : titleB
  }
  const aHasDigit = /\d/.test(titleA)
  const bHasDigit = /\d/.test(titleB)
  if (aHasDigit !== bHasDigit) {
    return aHasDigit ? titleA : titleB
  }
  return titleA
}

export function dedupe(items = [], { log = false } = {}) {
  if (!Array.isArray(items)) return []

  const map = new Map()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const title = cleanTitle(item.title)
    if (!title) continue

    const mergeKey = dedupeKey(title)
    const store = normalizeStore(item)
    const compositeKey = `${mergeKey}::${store}`

    const officialUrl = getOfficialClaimUrl(item)
    const worthInr = Number(
      item.worthInr ||
      (item._isItad ? item.regular : 0) ||
      (item.worth?.currency === 'INR' ? item.worth.amount : 0) ||
      0
    )

    const initialWorth = item.worth?.currency === 'INR'
      ? item.worth
      : (worthInr > 0
        ? { amount: worthInr, currency: 'INR', source: store || 'Official' }
        : (parseWorthUsd(item.worth) > 0 ? item.worth : null))

    const normalizedItem = {
      ...item,
      title,
      store: item.store || store,
      isMobile: isMobile(item),
      worthInr,
      worth: initialWorth,
      open_giveaway_url: officialUrl || item.open_giveaway_url || item.url || item.gamerpower_url || '',
    }

    if (!map.has(compositeKey)) {
      map.set(compositeKey, normalizedItem)
      continue
    }

    const existing = map.get(compositeKey)
    const isItemOfficial = isOfficialStoreSource(normalizedItem)
    const isExistingOfficial = isOfficialStoreSource(existing)

    let chosen = existing
    let dropped = normalizedItem
    let reason = ''

    if (isItemOfficial && !isExistingOfficial) {
      chosen = normalizedItem
      dropped = existing
      reason = 'official store source'
    } else if (isExistingOfficial && !isItemOfficial) {
      chosen = existing
      dropped = normalizedItem
      reason = 'official store source'
    } else {
      // Both official or neither official: compare end times (earlier is safer)
      const existingEnd = parseEndDate(existing.end_date || existing.endDate || existing.expiry)
      const itemEnd = parseEndDate(normalizedItem.end_date || normalizedItem.endDate || normalizedItem.expiry)

      if (itemEnd != null && existingEnd != null) {
        if (itemEnd < existingEnd) {
          chosen = normalizedItem
          dropped = existing
          reason = `earlier end time (${normalizedItem.end_date || normalizedItem.endDate} vs ${existing.end_date || existing.endDate})`
        } else {
          chosen = existing
          dropped = normalizedItem
          reason = `earlier end time (${existing.end_date || existing.endDate} vs ${normalizedItem.end_date || normalizedItem.endDate})`
        }
      } else if (itemEnd != null && existingEnd == null) {
        chosen = normalizedItem
        dropped = existing
        reason = 'known earlier end time vs TBA'
      } else if (existingEnd != null && itemEnd == null) {
        chosen = existing
        dropped = normalizedItem
        reason = 'known earlier end time vs TBA'
      } else {
        chosen = existing
        dropped = normalizedItem
        reason = 'earlier entry preserved'
      }
    }

    if (log) {
      console.log(`[freeGames:dedupe] Kept "${chosen.title}" (${reason}), merged/dropped "${dropped.title}"`)
    }

    // Earliest non-null end time
    const chosenEnd = parseEndDate(chosen.end_date || chosen.endDate || chosen.expiry)
    const droppedEnd = parseEndDate(dropped.end_date || dropped.endDate || dropped.expiry)
    let bestEnd = chosen.end_date || chosen.endDate || chosen.expiry || null
    if (droppedEnd != null && (chosenEnd == null || droppedEnd < chosenEnd)) {
      bestEnd = dropped.end_date || dropped.endDate || dropped.expiry
    }

    // Best image: prefer chosen's assets, high-res image
    const bestImage = chosen.image || chosen.thumbnail || dropped.image || dropped.thumbnail || ''
    const bestThumb = chosen.thumbnail || chosen.image || dropped.thumbnail || dropped.image || ''

    // Pick best claim URL
    const bestUrl = pickBestClaimUrl(chosen, dropped)

    // Best worth in INR
    const chosenWorthInr = Number(chosen.worthInr || (chosen.worth?.currency === 'INR' ? chosen.worth.amount : 0) || 0)
    const droppedWorthInr = Number(dropped.worthInr || (dropped.worth?.currency === 'INR' ? dropped.worth.amount : 0) || 0)
    const bestWorthInr = chosenWorthInr > 0 ? chosenWorthInr : droppedWorthInr
    const bestWorth = chosen.worth?.currency === 'INR'
      ? chosen.worth
      : (dropped.worth?.currency === 'INR'
        ? dropped.worth
        : (bestWorthInr > 0
          ? { amount: bestWorthInr, currency: 'INR', source: chosen.store || dropped.store || 'ITAD' }
          : (parseWorthUsd(chosen.worth) > 0 ? chosen.worth : (parseWorthUsd(dropped.worth) > 0 ? dropped.worth : null))))

    map.set(compositeKey, {
      ...dropped,
      ...chosen,
      title: pickNicerTitle(chosen.title, dropped.title),
      store: chosen.store || dropped.store || store,
      isMobile: Boolean(chosen.isMobile || dropped.isMobile),
      type: chosen.type || dropped.type || 'Game',
      image: bestImage,
      thumbnail: bestThumb,
      open_giveaway_url: bestUrl,
      worthInr: bestWorthInr,
      worth: bestWorth,
      steamAppId: chosen.steamAppId || dropped.steamAppId || null,
      platforms: chosen.platforms || dropped.platforms || '',
      platform: chosen.platform || dropped.platform || '',
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
