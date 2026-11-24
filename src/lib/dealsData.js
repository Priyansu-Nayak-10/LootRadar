import { useState, useEffect } from 'react'
import cachedFetch from './cachedFetch.js'

export const CHEAPSHARK_DEALS_URL =
  'https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=Savings&desc=0'

export const STORE_NAMES = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'GMG',
  '7': 'GOG',
  '11': 'Humble',
  '13': 'Ubisoft',
  '15': 'Fanatical',
  '21': 'WinGameStore',
  '23': 'GameBillet',
  '25': 'Epic Games',
  '27': 'Gamesplanet',
  '30': 'IndieGala',
  '35': 'DreamGame',
}

export const STORE_SLUGS = {
  '1': 'steam',
  '2': 'gamersgate',
  '3': 'gmg',
  '7': 'gog',
  '11': 'humble',
  '15': 'fanatical',
  '25': 'epic',
}

export const SLUG_TO_STORE_ID = {
  steam: '1',
  gamersgate: '2',
  gmg: '3',
  gog: '7',
  humble: '11',
  fanatical: '15',
  epic: '25',
}

export function formatStoreName(name) {
  if (!name) return 'PC Store'
  if (name.includes('Epic')) return 'Epic Games'
  if (name.includes('GreenMan')) return 'GMG'
  if (name.includes('Humble')) return 'Humble'
  if (name.includes('Ubisoft') || name.includes('Uplay')) return 'Ubisoft'
  return name
}

export function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : ''
}

export function formatDealPrice(amount, currency = 'USD', inrRate = null) {
  if (amount == null || amount === '') return '-'
  const val = Number(amount)
  if (!Number.isFinite(val)) return '-'
  if (val === 0) return 'Free'

  if (currency === 'INR' && inrRate && Number.isFinite(Number(inrRate))) {
    const inrValue = Math.round(val * Number(inrRate))
    return `₹${inrValue.toLocaleString('en-IN')}`
  }

  return `$${val.toFixed(2)}`
}

/**
 * DLC and non-base-game detector:
 * soundtrack, ost, artbook, season pass, expansion, skin pack, cosmetic,
 * dlc, downloadable content, upgrade, supporter, bundle, pack.
 */
export function isDlcLike(title = '') {
  if (!title || typeof title !== 'string') return false
  const regex =
    /(\bdlc\b|downloadable content|upgrade|supporter|bundle|\bpack\b|soundtrack|\bost\b|artbook|season pass|expansion|skin pack|cosmetic)/i
  return regex.test(title)
}

/**
 * Determines flag for a deal:
 * - 'lowest' when salePrice <= cheapestPriceEver.price (+ 0.01 tolerance)
 * - 'great' when dealRating >= 8 or savings >= 50
 * - null otherwise
 */
export function getDealFlag(salePrice, cheapestEverPrice, dealRating, savings) {
  const sPrice = Number(salePrice)
  const cPrice =
    cheapestEverPrice != null && cheapestEverPrice !== '' ? Number(cheapestEverPrice) : null

  if (Number.isFinite(sPrice) && Number.isFinite(cPrice) && cPrice >= 0) {
    if (sPrice <= cPrice + 0.01) {
      return 'lowest'
    }
  }

  const rating = Number(dealRating || 0)
  const save = Number(savings || 0)
  if (rating >= 8 || save >= 50) {
    return 'great'
  }

  return null
}

export function getDealImageUrl(deal) {
  if (deal?.steamAppID && deal.steamAppID !== '0' && deal.steamAppID !== 'null') {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
  }
  return deal?.thumb || null
}

export function selectTopDeals(allDeals, limit = 8) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []
  const valid = allDeals.filter(
    (d) => d && typeof d === 'object' && !isDlcLike(d.title)
  )

  // 1. Try savings >= 50%
  const over50 = valid.filter((d) => Number(d.savings) >= 50)
  if (over50.length >= 4) {
    return over50.sort((a, b) => Number(b.savings) - Number(a.savings)).slice(0, limit)
  }

  // 2. Try savings >= 30%
  const over30 = valid.filter((d) => Number(d.savings) >= 30)
  if (over30.length >= 4) {
    return over30.sort((a, b) => Number(b.savings) - Number(a.savings)).slice(0, limit)
  }

  // 3. Try savings >= 20%
  const over20 = valid.filter((d) => Number(d.savings) >= 20)
  if (over20.length > 0) {
    return over20.sort((a, b) => Number(b.savings) - Number(a.savings)).slice(0, limit)
  }

  // 4. Fallback: Top by dealRating
  return [...valid]
    .sort((a, b) => Number(b.dealRating || 0) - Number(a.dealRating || 0))
    .slice(0, limit)
}

export function selectHeroDeals(allDeals, count = 5) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []

  // 1. Filter out DLC items and items without an image
  const withImages = allDeals.filter((deal) => {
    if (!deal || typeof deal !== 'object') return false
    if (isDlcLike(deal.title)) return false
    const hasSteam = deal.steamAppID && deal.steamAppID !== '0' && deal.steamAppID !== 'null'
    const hasThumb = typeof deal.thumb === 'string' && deal.thumb.trim().length > 0
    return Boolean(hasSteam || hasThumb)
  })

  // 2. De-duplicate by title (keep highest dealRating / savings)
  const titleMap = new Map()
  for (const deal of withImages) {
    const key = (deal.title || '').trim().toLowerCase()
    if (!key) continue
    const existing = titleMap.get(key)
    if (!existing) {
      titleMap.set(key, deal)
    } else {
      const existingRating = Number(existing.dealRating || 0)
      const currentRating = Number(deal.dealRating || 0)
      if (
        currentRating > existingRating ||
        (currentRating === existingRating &&
          Number(deal.savings || 0) > Number(existing.savings || 0))
      ) {
        titleMap.set(key, deal)
      }
    }
  }

  const uniqueDeals = Array.from(titleMap.values())

  const sortByRatingAndSavings = (list) =>
    [...list].sort((a, b) => {
      const ratingA = Number(a.dealRating || 0)
      const ratingB = Number(b.dealRating || 0)
      if (Math.abs(ratingB - ratingA) > 0.001) return ratingB - ratingA
      return Number(b.savings || 0) - Number(a.savings || 0)
    })

  const pool50 = sortByRatingAndSavings(uniqueDeals.filter((d) => Number(d.savings) >= 50))
  const pool30 = sortByRatingAndSavings(uniqueDeals.filter((d) => Number(d.savings) >= 30))
  const pool20 = sortByRatingAndSavings(uniqueDeals.filter((d) => Number(d.savings) >= 20))
  const poolAll = sortByRatingAndSavings(uniqueDeals)

  let basePool = poolAll
  if (pool50.length >= 3) {
    basePool = pool50
  } else if (pool30.length >= 3) {
    basePool = pool30
  } else if (pool20.length >= 3) {
    basePool = pool20
  }

  const selected = basePool.slice(0, count)
  if (selected.length < count) {
    const selectedKeys = new Set(selected.map((d) => (d.title || '').trim().toLowerCase()))
    for (const deal of poolAll) {
      const key = (deal.title || '').trim().toLowerCase()
      if (!selectedKeys.has(key)) {
        selected.push(deal)
        selectedKeys.add(key)
        if (selected.length >= count) break
      }
    }
  }

  return selected
}

// ─── Batched Cheapest-Price-Ever Lazy Loader (24h Cache) ─────────────────────
const LOWEST_STORAGE_KEY = 'lootradar_lowest_prices_v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

let memoryLowestCache = null

export function getStoredLowestCache() {
  if (memoryLowestCache) return memoryLowestCache
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOWEST_STORAGE_KEY) : null
    if (raw) {
      memoryLowestCache = JSON.parse(raw)
      return memoryLowestCache
    }
  } catch {}
  memoryLowestCache = {}
  return memoryLowestCache
}

export function saveLowestCache(cache) {
  memoryLowestCache = cache
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOWEST_STORAGE_KEY, JSON.stringify(cache))
    }
  } catch {}
}

export async function fetchLowestPricesBatch(gameIds = []) {
  if (!Array.isArray(gameIds) || gameIds.length === 0) return {}

  const cache = getStoredLowestCache()
  const now = Date.now()
  const missing = []

  for (const id of gameIds) {
    const strId = String(id)
    const entry = cache[strId]
    if (!entry || now - (entry.cachedAt || 0) > CACHE_TTL_MS) {
      missing.push(strId)
    }
  }

  if (missing.length === 0) {
    return cache
  }

  const uniqueMissing = [...new Set(missing)]
  const BATCH_SIZE = 25
  for (let i = 0; i < uniqueMissing.length; i += BATCH_SIZE) {
    const batch = uniqueMissing.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(`https://www.cheapshark.com/api/1.0/games?ids=${batch.join(',')}`, {
        headers: { 'User-Agent': 'LootRadar/1.0 (free portfolio project)' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data && typeof data === 'object') {
          for (const [gId, info] of Object.entries(data)) {
            const price = info?.cheapestPriceEver?.price
            cache[gId] = {
              price: price != null ? Number(price) : null,
              date: info?.cheapestPriceEver?.date || null,
              cachedAt: now,
            }
          }
        }
      }
    } catch {
      // Don't fail the whole batch on error
    }
  }

  saveLowestCache(cache)
  return cache
}

export function useLowestPrices(visibleDeals = []) {
  const [lowestMap, setLowestMap] = useState(() => getStoredLowestCache())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const gameIds = visibleDeals
      .map((d) => d?.gameID)
      .filter((id) => id != null && String(id) !== '0')

    if (gameIds.length === 0) return

    let cancelled = false
    setLoading(true)

    fetchLowestPricesBatch(gameIds)
      .then((updated) => {
        if (!cancelled && updated) {
          setLowestMap({ ...updated })
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [visibleDeals])

  return { lowestMap, loading }
}

// ─── URL Query Parsing & Serialization ─────────────────────────────────────────
export function parseDealsParams(searchString = '') {
  const params = new URLSearchParams(searchString)
  const rawStore = params.get('store') || ''
  const store = SLUG_TO_STORE_ID[rawStore.toLowerCase()] || rawStore

  return {
    store,
    minDiscount: params.get('min') || '0',
    sort: params.get('sort') || 'deals',
    q: params.get('q') || '',
    lowestOnly: params.get('lowest') === 'true' || params.get('lowest') === '1',
    maxPrice: Number(params.get('maxPrice')) > 0 ? Number(params.get('maxPrice')) : 100,
    minRating: Number(params.get('rating')) > 0 ? Number(params.get('rating')) : 0,
    showExtras: params.get('extras') === 'true' || params.get('extras') === '1',
    currency: params.get('currency')?.toUpperCase() === 'INR' ? 'INR' : 'USD',
  }
}

export function serializeDealsParams(state = {}) {
  const params = new URLSearchParams()

  if (state.store) {
    const slug = STORE_SLUGS[String(state.store)] || state.store
    params.set('store', slug)
  }
  if (state.minDiscount && state.minDiscount !== '0') {
    params.set('min', state.minDiscount)
  }
  if (state.sort && state.sort !== 'deals') {
    params.set('sort', state.sort)
  }
  if (state.q && state.q.trim()) {
    params.set('q', state.q.trim())
  }
  if (state.lowestOnly) {
    params.set('lowest', '1')
  }
  if (state.maxPrice != null && Number(state.maxPrice) < 100) {
    params.set('maxPrice', String(state.maxPrice))
  }
  if (state.minRating != null && Number(state.minRating) > 0) {
    params.set('rating', String(state.minRating))
  }
  if (state.showExtras) {
    params.set('extras', '1')
  }
  if (state.currency && state.currency !== 'USD') {
    params.set('currency', state.currency)
  }

  const str = params.toString()
  return str ? `?${str}` : ''
}

// ─── Filtering & Sorting Engine ───────────────────────────────────────────────
export function filterAndSortDeals(deals = [], filters = {}, lowestPricesMap = {}) {
  if (!Array.isArray(deals)) return []

  const {
    q = '',
    store = '',
    minDiscount = '0',
    maxPrice = 100,
    minRating = 0,
    lowestOnly = false,
    showExtras = false,
    sort = 'deals',
  } = filters

  const minDiscNum = Number(minDiscount) || 0
  const maxPriceNum = Number(maxPrice) || 100
  const minRatingNum = Number(minRating) || 0
  const queryNorm = q.trim().toLowerCase()

  const filtered = deals.filter((deal) => {
    if (!deal || typeof deal !== 'object') return false

    // 1. DLC / extras filter
    if (!showExtras && isDlcLike(deal.title)) return false

    // 2. Search query filter
    if (queryNorm && !(deal.title || '').toLowerCase().includes(queryNorm)) {
      return false
    }

    // 3. Store filter
    if (store && String(deal.storeID) !== String(store)) {
      return false
    }

    // 4. Discount threshold
    const savings = Number(deal.savings || 0)
    if (savings < minDiscNum) return false

    // 5. Max price threshold
    const salePrice = Number(deal.salePrice || 0)
    if (salePrice > maxPriceNum) return false

    // 6. Rating threshold (Steam or Metacritic)
    if (minRatingNum > 0) {
      const steamRating = Number(deal.steamRatingPercent || 0)
      const metacritic = Number(deal.metacriticScore || 0)
      const bestRating = Math.max(steamRating, metacritic)
      if (bestRating < minRatingNum) return false
    }

    // 7. Lowest-ever only
    if (lowestOnly) {
      const lowestInfo = lowestPricesMap[String(deal.gameID)]
      const cheapestPrice = lowestInfo?.price
      if (cheapestPrice == null) return false
      if (salePrice > Number(cheapestPrice) + 0.01) return false
    }

    return true
  })

  // Sorting
  return filtered.sort((a, b) => {
    if (sort === 'savings') {
      return Number(b.savings || 0) - Number(a.savings || 0)
    }
    if (sort === 'price') {
      return Number(a.salePrice || 0) - Number(b.salePrice || 0)
    }
    if (sort === 'meta') {
      return Number(b.metacriticScore || 0) - Number(a.metacriticScore || 0)
    }
    // Default: 'deals' -> dealRating descending, then savings descending
    const ratingA = Number(a.dealRating || 0)
    const ratingB = Number(b.dealRating || 0)
    if (Math.abs(ratingB - ratingA) > 0.001) return ratingB - ratingA
    return Number(b.savings || 0) - Number(a.savings || 0)
  })
}

// ─── Module Cache for Deals ───────────────────────────────────────────────────
let inFlightPromise = null
let memoryCache = null

export async function fetchDealsData(forceRefresh = false) {
  if (!forceRefresh && memoryCache) {
    return memoryCache
  }
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    let loadedDeals = []
    let loadedStores = []
    let snapshotTime = null

    // 1. Try static snapshot
    try {
      const response = await fetch('/data/cheapshark-deals.json')
      if (response.ok) {
        const snapshot = await response.json()
        if (Array.isArray(snapshot?.deals) && snapshot.deals.length > 0) {
          loadedDeals = snapshot.deals
        }
        if (Array.isArray(snapshot?.stores) && snapshot.stores.length > 0) {
          loadedStores = snapshot.stores
        }
        if (snapshot?.generatedAt) {
          snapshotTime = snapshot.generatedAt
        }
      }
    } catch {
      // Snapshot failed, fallback to live
    }

    // 2. If snapshot has no deals >= 20%, fetch live
    const hasGoodDeals = loadedDeals.some((d) => Number(d.savings) >= 20)
    if (!hasGoodDeals) {
      try {
        const liveDeals = await cachedFetch(CHEAPSHARK_DEALS_URL)
        if (Array.isArray(liveDeals) && liveDeals.length > 0) {
          loadedDeals = liveDeals
          snapshotTime = null
        }
      } catch {
        // Keep loadedDeals
      }
    }

    // 3. Stores
    if (loadedStores.length === 0) {
      try {
        const liveStores = await cachedFetch('https://www.cheapshark.com/api/1.0/stores')
        if (Array.isArray(liveStores) && liveStores.length > 0) {
          loadedStores = liveStores
        }
      } catch {
        // Keep empty; STORE_NAMES fallback
      }
    }

    const result = {
      deals: loadedDeals,
      stores: loadedStores,
      snapshotTime,
      error: loadedDeals.length === 0,
    }
    memoryCache = result
    inFlightPromise = null
    return result
  })()

  return inFlightPromise
}

export function useTopDeals() {
  const [deals, setDeals] = useState(memoryCache?.deals || [])
  const [stores, setStores] = useState(memoryCache?.stores || [])
  const [loading, setLoading] = useState(!memoryCache)
  const [error, setError] = useState(memoryCache?.error || false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const result = await fetchDealsData(reloadKey > 0)
        if (cancelled) return
        setDeals(result.deals)
        setStores(result.stores)
        setError(result.error)
      } catch {
        if (cancelled) return
        setDeals([])
        setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return {
    deals,
    stores,
    loading,
    error,
    reload: () => {
      memoryCache = null
      setReloadKey((k) => k + 1)
    },
  }
}
