import { titleKey, isConsoleGame } from './wishlistAlerts.js'
import { matchDealForGame, formatDealPrice, formatStoreName } from './dealsData.js'

const ITAD_PRICE_CACHE_KEY = 'wishradar_itad_price_'
const ITAD_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Resolves the price, deal, or free status for a given game across multiple sources in strict priority order:
 * 1. Currently free (free-now snapshot: e.g. Epic giveaway) -> FREE NOW, end date, Claim button
 * 2. Always-free list -> Free, store link
 * 3. Existing deals snapshot (itad-deals.json via matchDealForGame) -> price, regular, discount, store, lowest ever, deal URL
 * 4. Live ITAD price (via /api/itad-prices) -> price, regular, discount, store, lowest ever, deal URL
 * 5. No price data (console games, unknown titles, failures) -> untracked/console/error message
 *
 * @param {Object} game - RAWG game object or game info
 * @param {Object} sources - { currentFreeGames, alwaysFreeGames, deals, livePrice, fetchError }
 * @returns {Object} offer object
 */
export function resolveGameOffer(game, sources = {}) {
  if (!game) {
    return { type: 'none', message: 'No game information' }
  }

  const rawTitle = game.name || game.title || ''
  const tKey = titleKey(rawTitle)

  // 0. Console games: no price lookup and no price alerts
  if (isConsoleGame(game)) {
    return {
      type: 'console',
      isConsole: true,
      message: 'Price not tracked for this platform',
      canFetchLive: false,
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

      return {
        type: 'always_free',
        badge: 'ALWAYS FREE',
        badgeType: 'free',
        price: 0,
        formattedPrice: 'Free',
        store: matchedAlways.publisher || matchedAlways.platform || 'PC',
        ctaText: 'Play free',
        ctaUrl: playUrl,
      }
    }
  }

  // 3. Existing deals snapshot (itad-deals.json)
  if (Array.isArray(deals) && deals.length > 0) {
    const matchedDeal = matchDealForGame(game, deals)
    if (matchedDeal && typeof matchedDeal.price === 'number') {
      const discount = Math.round(Number(matchedDeal.cut || 0))
      return {
        type: 'deal',
        badge: discount > 0 ? `-${discount}%` : null,
        badgeType: 'sale',
        price: matchedDeal.price,
        formattedPrice: formatDealPrice(matchedDeal.price),
        regular: matchedDeal.regular,
        formattedRegular: matchedDeal.regular
          ? formatDealPrice(matchedDeal.regular)
          : null,
        discount,
        store: formatStoreName(matchedDeal.shop?.name || matchedDeal.shop || 'Store'),
        isLowestEver: Boolean(matchedDeal.isLowestEver),
        expiry: matchedDeal.expiry || null,
        ctaText: 'Get deal',
        ctaUrl: matchedDeal.url || null,
      }
    }
  }

  // 4. Live ITAD price result
  if (livePrice) {
    const deal = livePrice.deal || (typeof livePrice.price === 'number' ? livePrice : null)
    if (deal && typeof deal.price === 'number') {
      const discount = Math.round(Number(deal.cut || 0))
      return {
        type: 'deal',
        badge: discount > 0 ? `-${discount}%` : null,
        badgeType: 'sale',
        price: deal.price,
        formattedPrice: formatDealPrice(deal.price),
        regular: deal.regular,
        formattedRegular: deal.regular ? formatDealPrice(deal.regular) : null,
        discount,
        store: formatStoreName(deal.shop?.name || deal.shop || 'Store'),
        isLowestEver: Boolean(deal.isLowestEver),
        expiry: deal.expiry || null,
        ctaText: 'Get deal',
        ctaUrl: deal.url || null,
      }
    }
  }

  // 5. Failed request or no price data
  if (fetchError) {
    return {
      type: 'error',
      message: 'Price unavailable right now',
      canRetry: true,
      error: fetchError,
    }
  }

  return {
    type: 'untracked',
    message: 'No current deal found for PC',
    canFetchLive: true,
  }
}

/**
 * Fetch a single game price from /api/itad-prices, cached in sessionStorage for 30 minutes.
 * Respects AbortController signal.
 *
 * @param {string} rawTitle - Game title
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object|null>} deal object or null
 */
export async function fetchLiveItadPrice(rawTitle, signal) {
  if (!rawTitle || typeof rawTitle !== 'string') return null
  const tKey = titleKey(rawTitle)
  if (!tKey) return null

  const cacheKey = `${ITAD_PRICE_CACHE_KEY}${tKey}`

  // 1. Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const { time, data } = JSON.parse(cached)
      if (Date.now() - time < ITAD_CACHE_TTL_MS) {
        return data
      }
    }
  } catch {
    // Continue if sessionStorage is unavailable
  }

  // 2. Query /api/itad-prices
  const response = await fetch(
    `/api/itad-prices?titles=${encodeURIComponent(rawTitle.trim())}`,
    { signal }
  )

  if (response.status === 429) {
    throw new Error('Price lookup rate limit reached. Please try again shortly.')
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch price (${response.status})`)
  }

  const result = await response.json()
  const priceEntry = result?.prices?.[rawTitle.trim()] || Object.values(result?.prices || {})[0] || null

  const dealData = priceEntry?.deal || null

  // 3. Cache valid response
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ time: Date.now(), data: dealData })
    )
  } catch {
    // Continue if storage quota exceeded
  }

  return dealData
}
