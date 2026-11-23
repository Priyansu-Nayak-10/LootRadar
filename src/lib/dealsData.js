import { useState, useEffect } from 'react'
import cachedFetch from './cachedFetch'

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

export function getDealImageUrl(deal) {
  if (deal.steamAppID && deal.steamAppID !== '0' && deal.steamAppID !== 'null') {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
  }
  return deal.thumb || null
}

export function selectTopDeals(allDeals, limit = 8) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []
  const valid = allDeals.filter((d) => d && typeof d === 'object')

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

/**
 * Selects up to `count` deals for the Hero carousel:
 * - Requires an image (Steam header or thumbnail)
 * - De-duplicates games by title
 * - Picks the best by dealRating with savings >= 50, falling back to >= 30, then >= 20, then best available.
 * - Parses savings as number.
 */
export function selectHeroDeals(allDeals, count = 5) {
  if (!Array.isArray(allDeals) || allDeals.length === 0) return []

  // 1. Filter out items without an image
  const withImages = allDeals.filter((deal) => {
    if (!deal || typeof deal !== 'object') return false
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
      if (currentRating > existingRating || (currentRating === existingRating && Number(deal.savings || 0) > Number(existing.savings || 0))) {
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

  // Fallback tiers
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

// Module-level cache & in-flight promise to ensure exactly ONE fetch across components
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
