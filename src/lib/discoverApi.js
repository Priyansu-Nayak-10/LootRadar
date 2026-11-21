const RAWG_BASE = 'https://api.rawg.io/api/games'
const NEWS_URL = 'https://proxy.cors.dev/https://gamebeeper.gg/feed.json'
const RAWG_CACHE_MS = 12 * 60 * 60 * 1000
const NEWS_CACHE_MS = 30 * 60 * 1000

const rawgKey = import.meta.env.VITE_RAWG_API_KEY?.trim()

export const hasRawgKey = Boolean(rawgKey)

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

export async function fetchRawgGames(parameters, cacheLabel) {
  if (!rawgKey) {
    throw new Error('Add your free RAWG API key to .env.local to load game discovery data.')
  }

  const query = new URLSearchParams(parameters)
  query.set('key', rawgKey)
  const cacheKey = `lootradar_rawg_${cacheLabel}`
  return fetchCachedJson(`${RAWG_BASE}?${query}`, cacheKey, RAWG_CACHE_MS)
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
