const RAWG_BASE = 'https://api.rawg.io/api/games'
const NEWS_URL = 'https://proxy.cors.dev/https://gamebeeper.gg/feed.json'
const RAWG_CACHE_MS = 12 * 60 * 60 * 1000
const NEWS_CACHE_MS = 30 * 60 * 1000

const rawgKey = import.meta.env.VITE_RAWG_API_KEY?.trim()

export const hasRawgKey = Boolean(rawgKey)

// ─── Platform filter mapping ─────────────────────────────────────────────────
const PLATFORM_IDS = {
  All: '',
  PC: '4',
  PlayStation: '187,18',   // PS5, PS4
  Xbox: '186,1',           // Xbox Series, Xbox One
}

async function fetchCachedJson(url, cacheKey, cacheMs) {
  let staleCache

  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      staleCache = JSON.parse(cached)
      if (Date.now() - staleCache.time < cacheMs) return staleCache.data
    }
  } catch {
    // Fetch fresh data if session storage is unavailable or invalid.
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Request failed (${response.status})`)
    const data = await response.json()
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data }))
    } catch {
      // Keep the fetched data available even if browser storage is blocked.
    }
    return data
  } catch (error) {
    if (staleCache?.data) return staleCache.data
    throw error
  }
}

export async function fetchRawgGames(parameters, cacheLabel, cacheMs = RAWG_CACHE_MS) {
  if (!rawgKey) {
    throw new Error('Add your free RAWG API key to .env.local to load game discovery data.')
  }

  const query = new URLSearchParams(parameters)
  query.set('key', rawgKey)
  const cacheKey = `lootradar_rawg_${cacheLabel}`
  return fetchCachedJson(`${RAWG_BASE}?${query}`, cacheKey, cacheMs)
}

// ─── Multi-variant search with smart ranking ─────────────────────────────────
import {
  normalizeQuery,
  generateVariants,
  expandAlias,
  dedupeGames,
  rankAndFilter,
} from './searchRank'

/**
 * Run a single RAWG search with the given query string.
 * Uses the shared cache layer.  Respects AbortController signal.
 */
async function rawgSearch(query, category, signal, isVariant = false) {
  if (!rawgKey) {
    throw new Error('Add your free RAWG API key to .env.local to load game discovery data.')
  }

  const params = new URLSearchParams({
    search: query,
    page_size: '25',
    exclude_additions: 'true',
    search_precise: isVariant ? 'false' : (query.split(/\s+/).length >= 3 ? 'true' : 'false'),
  })

  const platformIds = PLATFORM_IDS[category] || ''
  if (platformIds) params.set('platforms', platformIds)

  params.set('key', rawgKey)

  const cacheKey = `lootradar_rawg_search_${query.toLowerCase()}_${category || 'All'}`

  // Check cache first
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.time < RAWG_CACHE_MS) return parsed.data
    }
  } catch { /* continue to fetch */ }

  const response = await fetch(`${RAWG_BASE}?${params}`, { signal })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  const data = await response.json()
  const results = Array.isArray(data.results) ? data.results : []

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: results }))
  } catch { /* ignore quota errors */ }

  return results
}

/**
 * Smart multi-variant search:
 * 1. Run the original query
 * 2. If < 6 good results, run up to 2 variant/alias queries
 * 3. Dedupe, rank, and return top results
 *
 * Never more than 3 RAWG requests per search.
 * category: 'All' | 'PC' | 'PlayStation' | 'Xbox'
 */
export async function searchGamesMulti(rawQuery, category = 'All', signal) {
  const norm = normalizeQuery(rawQuery)
  if (!norm || norm.length < 2) return []

  let allResults = []
  let requestCount = 0

  // 1. Original query
  const primary = await rawgSearch(norm, category, signal)
  requestCount++
  allResults.push(...primary)

  // Count "good" results (has image and decent added count)
  const goodCount = primary.filter(
    (g) => g.background_image && (g.added || 0) > 30
  ).length

  // 2. Only run extra queries if primary didn't give enough good results
  if (goodCount < 6 && requestCount < 3) {
    const extraQueries = new Set()

    // Alias expansion
    const alias = expandAlias(norm)
    if (alias && alias !== norm) extraQueries.add(alias)

    // Hyphen / spacing / numeral variants
    const variants = generateVariants(norm)
    for (const v of variants) {
      if (v !== norm && v !== alias) {
        extraQueries.add(v)
      }
    }

    // Run up to 2 more queries
    const extras = [...extraQueries].slice(0, 3 - requestCount)
    const extraResults = await Promise.all(
      extras.map((q) => rawgSearch(q, category, signal, true).catch(() => []))
    )
    requestCount += extras.length
    for (const batch of extraResults) {
      allResults.push(...batch)
    }
  }

  // 3. Dedupe and rank
  return rankAndFilter(dedupeGames(allResults), norm)
}

export async function fetchGamingNews() {
  try {
    const response = await fetch('/data/gaming-news.json')
    if (!response.ok) throw new Error(`Request failed (${response.status})`)
    const data = await response.json()
    if (!Array.isArray(data.articles)) throw new Error('News snapshot is invalid')
    try {
      sessionStorage.setItem(
        'lootradar_gaming_news',
        JSON.stringify({ time: Date.now(), data })
      )
    } catch {
      // Keep the fetched snapshot available even if browser storage is blocked.
    }
    return data
  } catch {
    return fetchCachedJson(NEWS_URL, 'lootradar_gaming_news', NEWS_CACHE_MS)
  }
}
