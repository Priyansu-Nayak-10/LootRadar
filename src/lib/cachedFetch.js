const CACHE_MS = 10 * 60 * 1000

export default async function cachedFetch(url) {
  const key = `lr_${url}`

  try {
    const cached = sessionStorage.getItem(key)
    if (cached) {
      const { time, data } = JSON.parse(cached)
      if (Date.now() - time < CACHE_MS) return data
    }
  } catch {
    // Ignore unavailable or invalid cache data and fetch from the API.
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error('Request failed')
  const data = await response.json()

  try {
    sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data }))
  } catch {
    // The app can still use the fetched data if caching is blocked.
  }

  return data
}
