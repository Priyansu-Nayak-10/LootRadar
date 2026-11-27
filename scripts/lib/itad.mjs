export const ITAD_BASE_URL = 'https://api.isthereanydeal.com'
export const USER_AGENT = 'LootRadar/1.0 (free portfolio project)'
export const DEFAULT_COUNTRY = 'IN'
export const DEFAULT_CURRENCY = 'INR'
export const REQUEST_TIMEOUT_MS = 15000
export const MAX_RETRIES = 2
export const MAX_REQUESTS_PER_RUN = 60
export const REQUEST_DELAY_MS = 150

export const SHOP_ALLOWLIST = [
  { id: 61, name: 'Steam' },
  { id: 16, name: 'Epic Game Store' },
  { id: 52, name: 'EA Store' },
]

export const SHOP_ALLOWLIST_IDS = new Set(SHOP_ALLOWLIST.map((s) => s.id))
export const MAX_PRICES_BATCH_SIZE = 200

function sanitizeErrorMessage(message, apiKey) {
  let clean = String(message || 'Unknown error')
  if (apiKey && typeof apiKey === 'string' && apiKey.length >= 4) {
    clean = clean.split(apiKey).join('[REDACTED]')
  }
  return clean.replace(/(?:ITAD-API-Key|api[_-]?key|key)=[^\s&"']+/gi, '[REDACTED]')
}

function parseRetryAfterMs(headerValue) {
  if (!headerValue) return 1000
  const seconds = Number(headerValue)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.max(seconds * 1000, 200), 30000)
  }
  const dateMs = Date.parse(headerValue)
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 200), 30000)
  }
  return 1000
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createItadClient({
  apiKey = process.env.ITAD_API_KEY,
  fetchImpl = fetch,
  sleep = defaultSleep,
  maxRequests = MAX_REQUESTS_PER_RUN,
  delayMs = REQUEST_DELAY_MS,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  let requestsUsed = 0

  async function request(path, { method = 'GET', params = {}, body = undefined } = {}) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error('ITAD_API_KEY is missing')
    }
    const cleanKey = String(apiKey).trim()

    const url = new URL(path, ITAD_BASE_URL)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }

    let lastError
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (requestsUsed >= maxRequests) {
        throw new Error(`ITAD request budget exceeded (${maxRequests})`)
      }
      if (requestsUsed > 0 && delayMs > 0) {
        await sleep(delayMs)
      }

      requestsUsed++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const headers = {
          'User-Agent': USER_AGENT,
          'ITAD-API-Key': cleanKey,
          Accept: 'application/json',
        }
        if (body !== undefined) {
          headers['Content-Type'] = 'application/json'
        }

        const response = await fetchImpl(url.toString(), {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            const waitMs = parseRetryAfterMs(response.headers?.get?.('Retry-After'))
            await sleep(waitMs)
            continue
          }
          throw new Error(`ITAD rate limited (429) on ${url.pathname}`)
        }

        if (!response.ok) {
          throw new Error(`ITAD request failed (${response.status}) on ${url.pathname}`)
        }

        return await response.json()
      } catch (error) {
        clearTimeout(timer)
        lastError = new Error(sanitizeErrorMessage(error?.message || error, cleanKey))
        if (attempt < MAX_RETRIES) {
          await sleep(500 * (attempt + 1))
          continue
        }
      }
    }

    throw lastError || new Error(`ITAD request failed on ${url.pathname}`)
  }

  return {
    getRequestsUsed: () => requestsUsed,

    fetchDeals({
      shopId,
      country = DEFAULT_COUNTRY,
      limit = 200,
      offset = 0,
      sort = '-cut',
      nondeals = false,
      filter,
    } = {}) {
      return request('/deals/v2', {
        params: {
          country,
          limit,
          offset,
          sort,
          shops: shopId,
          nondeals: nondeals ? 'true' : 'false',
          filter: filter ? (typeof filter === 'string' ? filter : JSON.stringify(filter)) : undefined,
        },
      })
    },

    fetchPrices(gameIds = [], shopIds = SHOP_ALLOWLIST.map((s) => s.id), country = DEFAULT_COUNTRY) {
      return request('/games/prices/v3', {
        method: 'POST',
        params: {
          country,
          shops: Array.isArray(shopIds) ? shopIds.join(',') : shopIds,
        },
        body: gameIds,
      })
    },

    lookupGame({ title, appid } = {}) {
      return request('/games/lookup/v1', {
        params: { title, appid },
      })
    },

    searchGames(title, results = 10) {
      return request('/games/search/v1', {
        params: { title, results },
      })
    },

    lookupShopGameIds(gameIds = [], shopId = 61) {
      return request(`/lookup/shop/${shopId}/id/v1`, {
        method: 'POST',
        body: gameIds,
      })
    },
  }
}

const EDITION_WORDS_RE =
  /\b(deluxe|gold|ultimate|complete|goty|game of the year|definitive|collector(?:'s)?|premium|special|enhanced|anniversary|royal|director(?:'s)? cut)\b/i

export function normalizeForStrictMatch(title = '') {
  const raw = String(title || '').toLowerCase()
  const editionMatch = raw.match(EDITION_WORDS_RE)
  const edition = editionMatch ? editionMatch[1].replace(/['’]s/g, '').trim() : 'base'
  const base = raw
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(standard\s+edition|edition)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = base ? base.split(' ') : []
  return { base, edition, words }
}

export function strictMatchScore(queryTitle, candidateTitle) {
  const q = normalizeForStrictMatch(queryTitle)
  const c = normalizeForStrictMatch(candidateTitle)
  if (!q.base || !c.base) return 0
  // Edition words (deluxe/gold/ultimate/etc.) must match exactly
  if (q.edition !== c.edition) return 0

  if (q.base === c.base) return 3
  if (c.base.startsWith(q.base) || q.base.startsWith(c.base)) return 2

  const cSet = new Set(c.words)
  if (q.words.length > 0 && q.words.every((w) => cSet.has(w))) return 1
  return 0
}

export async function resolveItadId(client, title, steamAppId = null) {
  if (!client || (!title && !steamAppId)) return null

  if (steamAppId) {
    try {
      const byAppId = await client.lookupGame({ appid: steamAppId })
      if (byAppId?.found && byAppId?.game?.id) {
        return byAppId.game.id
      }
    } catch {
      // Fall through to title lookup
    }
  }

  if (!title || !String(title).trim()) return null
  const cleanQuery = String(title).trim()

  try {
    const exact = await client.lookupGame({ title: cleanQuery })
    if (exact?.found && exact?.game?.id) {
      if (!exact.game.title || strictMatchScore(cleanQuery, exact.game.title) > 0) {
        return exact.game.id
      }
    }
  } catch {
    // Fall through to search
  }

  try {
    const results = await client.searchGames(cleanQuery, 10)
    if (!Array.isArray(results) || results.length === 0) return null

    let bestCandidate = null
    let bestScore = 0
    for (const candidate of results) {
      if (!candidate?.id || !candidate?.title) continue
      if (candidate.type && candidate.type !== 'game') continue
      const score = strictMatchScore(cleanQuery, candidate.title)
      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }
    return bestCandidate ? bestCandidate.id : null
  } catch {
    return null
  }
}

export async function fetchPrices(client, ids = [], shopIds = SHOP_ALLOWLIST.map((s) => s.id)) {
  if (!client || !Array.isArray(ids) || ids.length === 0) return []
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const allEntries = []

  for (let i = 0; i < uniqueIds.length; i += MAX_PRICES_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + MAX_PRICES_BATCH_SIZE)
    const response = await client.fetchPrices(batch, shopIds, DEFAULT_COUNTRY)
    if (Array.isArray(response)) {
      allEntries.push(...response)
    }
  }

  return allEntries
}

export function bestDeal(priceEntry) {
  if (!priceEntry || !Array.isArray(priceEntry.deals) || priceEntry.deals.length === 0) {
    return null
  }

  const allowedDeals = priceEntry.deals.filter(
    (d) => d && d.shop && SHOP_ALLOWLIST_IDS.has(Number(d.shop.id))
  )
  if (allowedDeals.length === 0) return null

  const sorted = [...allowedDeals].sort((a, b) => {
    const priceA = Number(a?.price?.amount ?? Infinity)
    const priceB = Number(b?.price?.amount ?? Infinity)
    if (priceA !== priceB) return priceA - priceB
    return Number(b?.cut ?? 0) - Number(a?.cut ?? 0)
  })

  const best = sorted[0]
  const historyAll = priceEntry.historyLow?.all?.amount ?? priceEntry.historyLow?.amount ?? null
  const historyY1 = priceEntry.historyLow?.y1?.amount ?? null
  const historyM3 = priceEntry.historyLow?.m3?.amount ?? null

  let expiryIso = null
  if (best.expiry) {
    const ms = Date.parse(best.expiry)
    if (Number.isFinite(ms)) expiryIso = new Date(ms).toISOString()
  }

  const priceVal = Number(best.price?.amount ?? 0)
  const regularVal = Number(best.regular?.amount ?? 0)
  const historyLowVal = historyAll != null ? Number(historyAll) : null

  return {
    itadId: priceEntry.id || '',
    store: best.shop?.name || '',
    storeId: best.shop?.id ?? null,
    price: priceVal,
    regular: regularVal,
    cut: Number(best.cut ?? 0),
    currency: best.price?.currency || DEFAULT_CURRENCY,
    expiry: expiryIso,
    url: best.url || '',
    historyLow: historyLowVal,
    historyLow1y: historyY1 != null ? Number(historyY1) : null,
    historyLow3m: historyM3 != null ? Number(historyM3) : null,
    isLowestEver: historyLowVal !== null && priceVal <= historyLowVal,
  }
}

export function shouldAlert({ price, regular: _regular, cut, historyLow, sensitivity = 'good' } = {}) {
  const p = Number(price)
  const c = Number(cut ?? 0)
  const h = historyLow != null && Number.isFinite(Number(historyLow)) ? Number(historyLow) : null

  if (!Number.isFinite(p)) return false
  if (p === 0 || c >= 100) return true
  if (c < 15) return false

  if (sensitivity === 'any') {
    return c >= 25
  }
  if (sensitivity === 'great') {
    return c >= 50 || (h !== null && h > 0 && p <= h)
  }

  // Default: 'good'
  if (h !== null && h > 0) {
    return c >= 25 && p <= h * 1.1
  }
  return c >= 40
}

export function extractSteamAppId(rawShopId) {
  if (!rawShopId) return null
  const value = Array.isArray(rawShopId) ? rawShopId[0] : rawShopId
  if (typeof value !== 'string') return null
  const match = value.match(/app\/(\d+)/i)
  return match ? match[1] : null
}

export function normalizeDeal(item, { fetchedAt = new Date().toISOString(), steamAppId = null } = {}) {
  const deal = item?.deal || {}
  const assets = item?.assets || {}
  const priceAmount = Number(deal?.price?.amount ?? 0)
  const regularAmount = Number(deal?.regular?.amount ?? 0)
  const historyLowAmount = deal?.historyLow?.amount != null ? Number(deal.historyLow.amount) : null

  let expiryIso = null
  if (deal?.expiry) {
    const ms = Date.parse(deal.expiry)
    if (Number.isFinite(ms)) expiryIso = new Date(ms).toISOString()
  }

  let worth = null
  if (regularAmount > 0) {
    worth = {
      amount: regularAmount,
      currency: deal?.price?.currency || DEFAULT_CURRENCY,
      source: deal?.shop?.name || 'ITAD',
    }
  }

  return {
    itadId: item?.id || '',
    slug: item?.slug || '',
    title: item?.title || '',
    type: item?.type || '',
    image: assets.banner600 || assets.banner400 || assets.boxart || null,
    shop: {
      id: deal?.shop?.id ?? null,
      name: deal?.shop?.name || '',
    },
    price: priceAmount,
    regular: regularAmount,
    cut: Number(deal?.cut ?? 0),
    currency: deal?.price?.currency || DEFAULT_CURRENCY,
    worth,
    historyLow: historyLowAmount,
    historyLow1y: deal?.historyLow_1y?.amount != null ? Number(deal.historyLow_1y.amount) : null,
    historyLow3m: deal?.historyLow_3m?.amount != null ? Number(deal.historyLow_3m.amount) : null,
    isLowestEver: historyLowAmount !== null && priceAmount <= historyLowAmount,
    isNewLow: deal?.flag === 'N' || deal?.flag === 'H',
    expiry: expiryIso,
    url: deal?.url || '',
    platforms: Array.isArray(deal?.platforms) ? deal.platforms : [],
    steamAppId: steamAppId || null,
    fetchedAt,
  }
}

export function processItadDeals(rawItems = [], { fetchedAt = new Date().toISOString(), nowMs = Date.now() } = {}) {
  const gameItems = rawItems
    .filter((item) => item && item.type === 'game' && item.id && item.title && item.deal)
    .map((item) => normalizeDeal(item, { fetchedAt }))

  // Dedupe by itadId keeping the best (lowest) price, then highest cut
  const bestByItadId = new Map()
  for (const deal of gameItems) {
    const existing = bestByItadId.get(deal.itadId)
    if (!existing) {
      bestByItadId.set(deal.itadId, deal)
      continue
    }
    if (
      deal.price < existing.price ||
      (deal.price === existing.price && deal.cut > existing.cut)
    ) {
      bestByItadId.set(deal.itadId, deal)
    }
  }

  const deduped = [...bestByItadId.values()]

  const free = deduped
    .filter((d) => (d.price === 0 || d.cut >= 100) && (!d.expiry || Date.parse(d.expiry) > nowMs))
    .sort((a, b) => a.title.localeCompare(b.title))

  const deals = deduped
    .filter((d) => d.price > 0 && d.cut >= 20 && (!d.expiry || Date.parse(d.expiry) > nowMs))
    .sort((a, b) => {
      if (b.cut !== a.cut) return b.cut - a.cut
      if (a.isLowestEver !== b.isLowestEver) return a.isLowestEver ? -1 : 1
      if (a.isNewLow !== b.isNewLow) return a.isNewLow ? -1 : 1
      return a.price - b.price
    })
    .slice(0, 120)

  return { deals, free }
}

export async function collectItadSnapshot({
  apiKey = process.env.ITAD_API_KEY,
  fetchImpl = fetch,
  sleep = defaultSleep,
  shops = SHOP_ALLOWLIST,
  now = new Date(),
} = {}) {
  const client = createItadClient({ apiKey, fetchImpl, sleep })
  const fetchedAt = now.toISOString()

  const perShopCounts = {}
  const emptyShops = []
  const allRawItems = []

  for (const shop of shops) {
    try {
      const data = await client.fetchDeals({
        shopId: shop.id,
        country: DEFAULT_COUNTRY,
        limit: 200,
        offset: 0,
        sort: '-cut',
        nondeals: false,
      })
      const list = Array.isArray(data?.list) ? data.list : []
      perShopCounts[shop.name] = list.length
      if (list.length === 0) emptyShops.push(shop.name)
      allRawItems.push(...list)
    } catch (error) {
      perShopCounts[shop.name] = 0
      emptyShops.push(shop.name)
      console.warn(`ITAD shop fetch failed (${shop.name}): ${error.message}`)
    }
  }

  const { deals, free } = processItadDeals(allRawItems, { fetchedAt })

  // Batch lookup Steam AppIDs for image fallbacks within request budget
  const targetIds = [...new Set([...deals, ...free].map((d) => d.itadId))]
  if (targetIds.length > 0 && client.getRequestsUsed() < MAX_REQUESTS_PER_RUN) {
    try {
      const map = await client.lookupShopGameIds(targetIds.slice(0, 200), 61)
      if (map && typeof map === 'object') {
        for (const item of [...deals, ...free]) {
          const appId = extractSteamAppId(map[item.itadId])
          if (appId) item.steamAppId = appId
        }
      }
    } catch (error) {
      console.warn(`ITAD Steam appid lookup skipped: ${error.message}`)
    }
  }

  return {
    generatedAt: fetchedAt,
    country: DEFAULT_COUNTRY,
    currency: DEFAULT_CURRENCY,
    shops: shops.map((s) => ({ id: s.id, name: s.name })),
    deals,
    free,
    stats: {
      requestsUsed: client.getRequestsUsed(),
      perShopCounts,
      emptyShops,
    },
  }
}
