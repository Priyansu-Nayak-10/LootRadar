import { titleKey, isConsoleGame } from './wishlistAlerts.js'
import { matchDealForGame, formatDealPrice, formatStoreName } from './dealsData.js'
import { normalizeRawgStore, sortStoresByPriority } from './rawgStores.js'
import { fetchWithTimeout } from './snapshots.js'

const ITAD_PRICE_CACHE_KEY = 'wishradar_itad_price_'
const ITAD_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function pickRawgFallback(rawgStores = [], preferredStoreName = null) {
  const normalized = (Array.isArray(rawgStores) ? rawgStores : [])
    .map((s) => (s && s.name && 'url' in s ? s : normalizeRawgStore(s)))
    .filter((s) => s && s.url)
  if (normalized.length === 0) return null
  return sortStoresByPriority(normalized, preferredStoreName)[0] || null
}

/**
 * Resolves the price, deal, free, no_deal, console, or error state for a game.
 * Priority:
 * 1. Console-only games -> console (with RAWG store fallback CTA if available)
 * 2. Currently free (free-now snapshot) -> free_now
 * 3. Always-free list -> always_free
 * 4. Existing deals snapshot -> deal / price
 * 5. Live ITAD price -> deal (cut > 0) / price (cut === 0) / no_deal
 * 6. Fetch error -> error (with RAWG store fallback CTA if available)
 * 7. Untracked -> untracked (with RAWG store fallback CTA if available)
 */
export function resolveGameOffer(game, sources = {}) {
  if (!game) {
    return { type: 'none', message: 'No game information', ctaUrl: null, ctaText: null }
  }

  const rawTitle = game.name || game.title || ''
  const tKey = titleKey(rawTitle)

  const rawgStores = Array.isArray(sources.rawgStores)
    ? sources.rawgStores
    : Array.isArray(game.stores)
      ? game.stores.map(normalizeRawgStore).filter(Boolean)
      : []

  // 0. Console games: no price lookup, but still provide RAWG store link if available
  if (isConsoleGame(game)) {
    const fallback = pickRawgFallback(rawgStores)
    return {
      type: 'console',
      isConsole: true,
      message: 'Price not tracked for consoles',
      canFetchLive: false,
      ctaUrl: fallback?.url || null,
      ctaText: fallback ? `View on ${fallback.name}` : null,
    }
  }

  const {
    currentFreeGames = [],
    alwaysFreeGames = [],
    deals = [],
    livePrice = null,
    fetchError = null,
  } = sources

  // 1. Currently free (free-now snapshot)
  if (Array.isArray(currentFreeGames) && currentFreeGames.length > 0 && tKey) {
    const matchedFree = currentFreeGames.find((f) => {
      if (!f) return false
      const fTitle = f.title || f.name || ''
      return titleKey(fTitle) === tKey
    })

    if (matchedFree) {
      const claimUrl =
        matchedFree.claimUrl ||
        matchedFree.url ||
        matchedFree.link ||
        (matchedFree.slug ? `https://store.epicgames.com/p/${matchedFree.slug}` : null) ||
        'https://store.epicgames.com/free-games'

      return {
        type: 'free_now',
        badge: 'FREE NOW',
        badgeType: 'free',
        price: 0,
        formattedPrice: 'Free',
        regular: matchedFree.regular || matchedFree.originalPrice || null,
        formattedRegular: matchedFree.regular
          ? formatDealPrice(matchedFree.regular)
          : null,
        discount: 100,
        store: matchedFree.store || 'Epic Games Store',
        endDate: matchedFree.endDate || null,
        ctaText: 'Claim free',
        ctaUrl: claimUrl,
        isLowestEver: true,
      }
    }
  }

  // 2. Always-free list
  if (Array.isArray(alwaysFreeGames) && alwaysFreeGames.length > 0 && tKey) {
    const matchedAlways = alwaysFreeGames.find((a) => {
      if (!a) return false
      const aTitle = a.title || a.name || ''
      return titleKey(aTitle) === tKey
    })

    if (matchedAlways) {
      const playUrl =
        matchedAlways.gameUrl ||
        matchedAlways.profileUrl ||
        matchedAlways.url ||
        null
      const fallback = !playUrl ? pickRawgFallback(rawgStores) : null

      return {
        type: 'always_free',
        badge: 'ALWAYS FREE',
        badgeType: 'free',
        price: 0,
        formattedPrice: 'Free',
        store: matchedAlways.publisher || matchedAlways.platform || 'PC',
        ctaText: playUrl ? 'Play free' : (fallback ? `View on ${fallback.name}` : 'Play free'),
        ctaUrl: playUrl || fallback?.url || null,
      }
    }
  }

  // 3. Existing deals snapshot (itad-deals.json)
  if (Array.isArray(deals) && deals.length > 0) {
    const matchedDeal = matchDealForGame(game, deals)
    if (matchedDeal && typeof matchedDeal.price === 'number') {
      const discount = Math.round(Number(matchedDeal.cut || 0))
      const storeName = formatStoreName(matchedDeal.shop?.name || matchedDeal.shop || 'Store')
      const fallback = pickRawgFallback(rawgStores, storeName)
      const ctaUrl = matchedDeal.url || fallback?.url || null
      return {
        type: discount > 0 ? 'deal' : 'price',
        badge: discount > 0 ? `-${discount}%` : null,
        badgeType: discount > 0 ? 'sale' : null,
        price: matchedDeal.price,
        formattedPrice: formatDealPrice(matchedDeal.price),
        regular: matchedDeal.regular,
        formattedRegular: matchedDeal.regular
          ? formatDealPrice(matchedDeal.regular)
          : null,
        discount,
        store: storeName,
        isLowestEver: Boolean(matchedDeal.isLowestEver),
        expiry: matchedDeal.expiry || null,
        ctaText: matchedDeal.url ? 'Get deal' : (fallback ? `View on ${fallback.name}` : 'Get deal'),
        ctaUrl,
      }
    }
  }

  // 4. Live ITAD price result
  if (livePrice) {
    const deal = livePrice.deal || (typeof livePrice.price === 'number' ? livePrice : null)
    if (deal && typeof deal.price === 'number') {
      const discount = Math.round(Number(deal.cut || 0))
      const storeName = formatStoreName(deal.shop?.name || deal.shop || 'Store')
      const fallback = pickRawgFallback(rawgStores, storeName)
      const ctaUrl = deal.url || fallback?.url || null
      return {
        type: discount > 0 ? 'deal' : 'price',
        badge: discount > 0 ? `-${discount}%` : null,
        badgeType: discount > 0 ? 'sale' : null,
        price: deal.price,
        formattedPrice: formatDealPrice(deal.price),
        regular: deal.regular,
        formattedRegular: deal.regular ? formatDealPrice(deal.regular) : null,
        discount,
        store: storeName,
        isLowestEver: Boolean(deal.isLowestEver),
        expiry: deal.expiry || null,
        ctaText: deal.url ? 'Get deal' : (fallback ? `View on ${fallback.name}` : 'Get deal'),
        ctaUrl,
      }
    }

    if (livePrice.status === 'no_deal') {
      const fallback = pickRawgFallback(rawgStores)
      return {
        type: 'no_deal',
        message: 'No current price from tracked stores',
        canFetchLive: false,
        ctaUrl: fallback?.url || null,
        ctaText: fallback ? `View on ${fallback.name}` : null,
      }
    }
  }

  // 5. Failed request
  if (fetchError) {
    const fallback = pickRawgFallback(rawgStores)
    return {
      type: 'error',
      message: "Couldn't load price",
      canRetry: true,
      error: fetchError,
      ctaUrl: fallback?.url || null,
      ctaText: fallback ? `View on ${fallback.name}` : null,
    }
  }

  // 6. Untracked / not yet queried
  const fallback = pickRawgFallback(rawgStores)
  return {
    type: 'untracked',
    message: 'No current deal found for PC',
    canFetchLive: true,
    ctaUrl: fallback?.url || null,
    ctaText: fallback ? `View on ${fallback.name}` : null,
  }
}

/**
 * Fetch a single game price from /api/itad-prices, cached in sessionStorage for 30 minutes.
 * Returns { status: 'found' | 'no_deal', deal: Object|null, itadId: string|null }.
 */
export async function fetchLiveItadPrice(rawTitle, signal) {
  if (!rawTitle || typeof rawTitle !== 'string') return { status: 'no_deal', deal: null, itadId: null }
  const tKey = titleKey(rawTitle)
  if (!tKey) return { status: 'no_deal', deal: null, itadId: null }

  const cacheKey = `${ITAD_PRICE_CACHE_KEY}${tKey}`

  // 1. Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const { time, data } = JSON.parse(cached)
      if (Date.now() - time < ITAD_CACHE_TTL_MS && data && typeof data === 'object' && 'status' in data) {
        return data
      }
    }
  } catch {
    // Continue if sessionStorage is unavailable
  }

  // 2. Query /api/itad-prices
  let response
  try {
    response = await fetchWithTimeout(
      `/api/itad-prices?titles=${encodeURIComponent(rawTitle.trim())}`,
      { signal }
    )
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const netErr = new Error(
      err?.name === 'TimeoutError'
        ? 'Price lookup timed out. Please try again.'
        : (err?.message || 'Network error while fetching price')
    )
    netErr.code = 'NETWORK_ERROR'
    throw netErr
  }

  if (response.status === 429) {
    const rateErr = new Error('Price lookup rate limit reached. Please try again shortly.')
    rateErr.code = 'RATE_LIMIT'
    throw rateErr
  }
  if (!response.ok) {
    const httpErr = new Error(`Failed to fetch price (${response.status})`)
    httpErr.code = 'HTTP_ERROR'
    httpErr.status = response.status
    throw httpErr
  }

  const contentType = response.headers?.get?.('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const nonJsonErr = new Error('Price service returned a non-JSON response')
    nonJsonErr.code = 'NON_JSON'
    throw nonJsonErr
  }

  const result = await response.json()
  const priceEntry = result?.prices?.[rawTitle.trim()] || Object.values(result?.prices || {})[0] || null
  const dealData = priceEntry?.deal || null

  const payload = {
    status: dealData ? 'found' : 'no_deal',
    deal: dealData,
    itadId: priceEntry?.itadId || null,
  }

  // 3. Cache valid response
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ time: Date.now(), data: payload })
    )
  } catch {
    // Continue if storage quota exceeded
  }

  return payload
}
