import { useCallback, useEffect, useState } from 'react'

export const ITAD_DEALS_URL = '/data/itad-deals.json'
const DEALS_CACHE_KEY = 'wishradar_itad_deals_v1'
const DEALS_CACHE_TTL_MS = 10 * 60 * 1000
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000

export const STORE_NAMES = {
  '61': 'Steam',
  '16': 'Epic Game Store',
  '52': 'EA Store',
}

export const STORE_SLUGS = {
  '61': 'steam',
  '16': 'epic',
  '52': 'ea',
}

export const SLUG_TO_STORE_ID = {
  steam: '61',
  epic: '16',
  ea: '52',
}

export function formatStoreName(name) {
  if (!name) return 'PC Store'
  if (name === 'Epic Game Store' || name.includes('Epic')) return 'Epic'
  if (name === 'EA Store' || name === 'Origin') return 'EA Store'
  return name
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

export function formatDealPrice(amount) {
  if (amount == null || amount === '') return '-'
  const val = Number(amount)
  if (!Number.isFinite(val)) return '-'
  if (val === 0) return 'Free'
  const hasPaise = Math.abs(val - Math.trunc(val)) > 0.001
  return hasPaise ? INR_PAISE_FORMATTER.format(val) : INR_WHOLE_FORMATTER.format(val)
}

export function formatDealExpiry(expiry, now = Date.now()) {
  if (!expiry) return null
  const ms = Date.parse(expiry)
  if (!Number.isFinite(ms)) return null
  const diff = ms - now
  if (diff <= 0) return 'Ended'

  const hoursTotal = Math.floor(diff / 3600000)
  if (hoursTotal < 72) {
    const days = Math.floor(hoursTotal / 24)
    const hours = hoursTotal % 24
    if (days > 0) return `Ends in ${days}d ${hours}h`
    if (hours > 0) return `Ends in ${hours}h`
    const mins = Math.max(1, Math.floor(diff / 60000))
    return `Ends in ${mins}m`
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms))
  return `Ends ${formatted}`
}

export function formatUpdatedAgo(generatedAt, now = Date.now()) {
  if (!generatedAt) return ''
  const ms = Date.parse(generatedAt)
  if (!Number.isFinite(ms)) return ''
  const diffMs = Math.max(0, now - ms)
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days}d ago`
}

export function getDealImageUrl(deal) {
  if (deal?.image) return deal.image
  if (deal?.steamAppId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppId}/header.jpg`
  }
  return null
}

const EDITION_PATTERN =
  /\b(deluxe|ultimate|gold|complete|goty|game of the year|definitive|collector(?:'s)?|premium|special|digital deluxe|enhanced|anniversary|royal|director(?:'s)? cut)\b/i

export function extractBaseAndEdition(title = '') {
  const raw = String(title || '').toLowerCase()
  const editionMatch = raw.match(EDITION_PATTERN)
  const edition = editionMatch ? editionMatch[1].replace(/['’]s/g, '').trim() : 'base'

  const normalizedBase = raw
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(standard\s+edition|edition)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { base: normalizedBase, edition }
}

export function matchDealForGame(game, deals = []) {
  if (!game || !Array.isArray(deals) || deals.length === 0) return null
  const gameTitle = game.name || game.title || ''
  const gameSteamId = game.steamAppId || game.steamAppID || null

  if (gameSteamId) {
    const bySteam = deals.find(
      (d) => d?.steamAppId && String(d.steamAppId) === String(gameSteamId)
    )
    if (bySteam) return bySteam
  }

  const target = extractBaseAndEdition(gameTitle)
  if (!target.base) return null

  return (
    deals.find((d) => {
      if (!d?.title) return false
      const candidate = extractBaseAndEdition(d.title)
      return candidate.base === target.base && candidate.edition === target.edition
    }) || null
  )
}

export function selectTopDeals(allDeals, limit = 8) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []
  const valid = allDeals.filter((d) => d && typeof d === 'object' && d.type === 'game')

  const over50 = valid.filter((d) => Number(d.cut) >= 50)
  if (over50.length >= limit) {
    return over50.slice(0, limit)
  }

  const over30 = valid.filter((d) => Number(d.cut) >= 30)
  if (over30.length >= limit) {
    return over30.slice(0, limit)
  }

  return valid.slice(0, limit)
}

export function selectHeroDeals(allDeals, count = 3) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []

  const withImages = allDeals.filter((deal) => {
    if (!deal || typeof deal !== 'object') return false
    if (deal.type !== 'game') return false
    return Boolean(deal.image || deal.steamAppId)
  })

  const seen = new Set()
  const unique = []
  for (const d of withImages) {
    const key = d.itadId || d.title?.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(d)
  }

  const over50 = unique.filter((d) => Number(d.cut) >= 50)
  if (over50.length >= count) return over50.slice(0, count)

  const over30 = unique.filter((d) => Number(d.cut) >= 30)
  if (over30.length >= count) return over30.slice(0, count)

  return unique.slice(0, count)
}

// ─── URL Query Parsing & Serialization ─────────────────────────────────────────
export const MAX_PRICE_CAP = 5000

export function parseDealsParams(searchString = '') {
  const params = new URLSearchParams(searchString)
  const rawStore = params.get('store') || ''
  const store = SLUG_TO_STORE_ID[rawStore.toLowerCase()] || rawStore
  const rawMax = Number(params.get('maxPrice'))

  return {
    store,
    minDiscount: params.get('min') || '0',
    sort: params.get('sort') || 'deals',
    q: params.get('q') || '',
    lowestOnly: params.get('lowest') === 'true' || params.get('lowest') === '1',
    maxPrice: Number.isFinite(rawMax) && rawMax > 0 && rawMax <= MAX_PRICE_CAP ? rawMax : MAX_PRICE_CAP,
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
  if (state.maxPrice != null && Number(state.maxPrice) < MAX_PRICE_CAP) {
    params.set('maxPrice', String(state.maxPrice))
  }

  const str = params.toString()
  return str ? `?${str}` : ''
}

// ─── Filtering & Sorting Engine ───────────────────────────────────────────────
export function filterAndSortDeals(deals = [], filters = {}) {
  if (!Array.isArray(deals)) return []

  const {
    q = '',
    store = '',
    minDiscount = '0',
    maxPrice = MAX_PRICE_CAP,
    lowestOnly = false,
    sort = 'deals',
  } = filters

  const minDiscNum = Number(minDiscount) || 0
  const maxPriceNum = Number(maxPrice)
  const hasMaxCap = Number.isFinite(maxPriceNum) && maxPriceNum < MAX_PRICE_CAP
  const queryNorm = q.trim().toLowerCase()

  const filtered = deals.filter((deal) => {
    if (!deal || typeof deal !== 'object') return false
    if (queryNorm && !(deal.title || '').toLowerCase().includes(queryNorm)) return false
    if (store && String(deal.shop?.id) !== String(store)) return false
    if (Number(deal.cut || 0) < minDiscNum) return false
    if (hasMaxCap && Number(deal.price || 0) > maxPriceNum) return false
    if (lowestOnly && !deal.isLowestEver) return false
    return true
  })

  if (sort === 'deals') {
    return filtered
  }

  return [...filtered].sort((a, b) => {
    if (sort === 'savings') {
      return Number(b.cut || 0) - Number(a.cut || 0)
    }
    if (sort === 'price') {
      return Number(a.price || 0) - Number(b.price || 0)
    }
    if (sort === 'expiry') {
      const expA = a.expiry ? Date.parse(a.expiry) : Infinity
      const expB = b.expiry ? Date.parse(b.expiry) : Infinity
      const safeA = Number.isFinite(expA) ? expA : Infinity
      const safeB = Number.isFinite(expB) ? expB : Infinity
      return safeA - safeB
    }
    return 0
  })
}

// ─── Shared Snapshot Fetcher & Hook ───────────────────────────────────────────
let inFlightPromise = null
let memoryCache = null

function readSessionCache() {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(DEALS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed?.data &&
      Array.isArray(parsed.data.deals) &&
      parsed.data.deals.length > 0 &&
      Date.now() - parsed.time < DEALS_CACHE_TTL_MS
    ) {
      return parsed.data
    }
  } catch {
    // Ignore storage errors
  }
  return null
}

function writeSessionCache(data) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DEALS_CACHE_KEY, JSON.stringify({ time: Date.now(), data }))
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchDealsData(forceRefresh = false) {
  if (!forceRefresh && memoryCache) {
    return memoryCache
  }
  if (!forceRefresh) {
    const cached = readSessionCache()
    if (cached) {
      memoryCache = cached
      return cached
    }
  }
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    try {
      const response = await fetch(ITAD_DEALS_URL, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`Could not load deals (${response.status})`)
      }
      const snapshot = await response.json()
      const deals = Array.isArray(snapshot?.deals) ? snapshot.deals : []
      const free = Array.isArray(snapshot?.free) ? snapshot.free : []
      const stores = Array.isArray(snapshot?.shops) ? snapshot.shops : []
      const generatedAt = snapshot?.generatedAt || null

      if (deals.length === 0) {
        throw new Error('Deals snapshot is empty')
      }

      const result = {
        deals,
        free,
        stores,
        generatedAt,
        error: false,
      }
      memoryCache = result
      writeSessionCache(result)
      return result
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}

export function useDeals() {
  const initial = memoryCache || readSessionCache()
  const [state, setState] = useState(() => ({
    deals: initial?.deals || [],
    free: initial?.free || [],
    stores: initial?.stores || [],
    generatedAt: initial?.generatedAt || null,
    loading: !initial,
    error: false,
  }))
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: false }))
      try {
        const result = await fetchDealsData(reloadKey > 0)
        if (cancelled) return
        setState({
          deals: result.deals,
          free: result.free,
          stores: result.stores,
          generatedAt: result.generatedAt,
          loading: false,
          error: false,
        })
      } catch {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: prev.deals.length === 0,
        }))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = useCallback(() => {
    memoryCache = null
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(DEALS_CACHE_KEY)
      }
    } catch {}
    setReloadKey((k) => k + 1)
  }, [])

  const ageMs = state.generatedAt ? Math.max(0, Date.now() - Date.parse(state.generatedAt)) : 0
  const isStale = Boolean(state.generatedAt) && Number.isFinite(ageMs) && ageMs > STALE_THRESHOLD_MS

  return {
    ...state,
    updatedLabel: formatUpdatedAgo(state.generatedAt),
    isStale,
    reload,
  }
}
