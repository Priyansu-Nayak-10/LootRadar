const NEWS_CACHE_KEY = 'lootradar_gaming_news_v2'
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000

export function cleanNewsText(value = '') {
  return String(value || '')
    .replace(/Â·/g, '·')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\u009d|â€/g, '"')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
    .trim()
}

export function formatNewsRelativeTime(value, now = Date.now()) {
  if (!value) return ''
  const date = new Date(value)
  const ts = date.getTime()
  if (Number.isNaN(ts)) return ''

  const diffMs = Math.max(0, now - ts)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days <= 3) return `${days}d ago`

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function getSnapshotAgeHours(generatedAt, now = Date.now()) {
  if (!generatedAt) return 0
  const ts = Date.parse(generatedAt)
  if (!Number.isFinite(ts)) return 0
  return Math.max(0, (now - ts) / 3600000)
}

export async function fetchNewsSnapshot({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    try {
      const raw = sessionStorage.getItem(NEWS_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (
          cached?.data &&
          Array.isArray(cached.data.articles) &&
          cached.data.articles.length > 0 &&
          Date.now() - cached.time < NEWS_CACHE_TTL_MS
        ) {
          return cached.data
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const response = await fetch('/data/gaming-news.json', { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`News snapshot unavailable (${response.status})`)
  }
  const data = await response.json()
  if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
    throw new Error('News snapshot is empty or invalid')
  }

  try {
    sessionStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ time: Date.now(), data })
    )
  } catch {
    // Ignore storage quota errors
  }

  return data
}
