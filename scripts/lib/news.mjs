import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'

export const USER_AGENT = 'LootRadar/1.0 (free portfolio project)'

export const NEWS_FEEDS = [
  { source: 'IGN', url: 'https://www.ign.com/rss/v2/articles/feed', limit: 20 },
  { source: 'PC Gamer', url: 'https://www.pcgamer.com/feeds.xml', limit: 20 },
  { source: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', limit: 20 },
  { source: 'Eurogamer', url: 'https://www.eurogamer.net/feed', limit: 20 },
  { source: 'VGC', url: 'https://www.videogameschronicle.com/feed/', limit: 20 },
  { source: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', limit: 20 },
  { source: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed', limit: 20 },
  { source: 'GamesRadar+', url: 'https://www.gamesradar.com/feeds.xml', limit: 20 },
  { source: 'Kotaku', url: 'https://kotaku.com/rss', limit: 20 },
  { source: 'Push Square', url: 'https://www.pushsquare.com/feeds/latest', limit: 20 },
  { source: 'Pure Xbox', url: 'https://www.purexbox.com/feeds/latest', limit: 20 },
]

export const SHOPPING_BLOCKLIST = [
  'black friday',
  'cyber monday',
  'best deals',
  'deals:',
  'deal alert',
  'coupon',
  'promo code',
  'where to buy',
  'preorder bonus',
  /\bbest\b.*\bunder\s*\$/i,
]

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'taid',
  'cmpid',
  'ref',
  'ref_src',
  'src',
  'guccounter',
  'guce_referrer',
  'guce_referrer_sig',
])

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'you',
  'your', 'we', 'our', 'they', 'their', 'he', 'she', 'his', 'her', 'what',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'more',
  'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'now', 'here', 'there', 'into', 'over', 'after',
  'before', 'about', 'out', 'up', 'down', 'off', 'new', 'get', 'gets', 'got',
  'says', 'said', 'report', 'reports', 'revealed', 'reveals', 'announced',
  'announces', 'update', 'updates', 'game', 'games', 'gaming', 'trailer',
])

const KNOWN_GAMES = [
  'gta 6', 'grand theft auto 6', 'grand theft auto vi',
  'elden ring', 'nightreign',
  'monster hunter wilds',
  'hollow knight silksong', 'silksong',
  'civilization 7', 'civilization vii',
  'assassin\'s creed shadows', 'assassins creed shadows',
  'death stranding 2',
  'ghost of yotei',
  'witcher 4', 'the witcher 4',
  'cyberpunk 2077', 'cyberpunk 2',
  'baldurs gate 3', "baldur's gate 3",
  'call of duty', 'black ops', 'warzone',
  'fortnite', 'minecraft', 'roblox', 'valorant', 'apex legends',
  'overwatch 2', 'marvel rivals', 'helldivers 2', 'destiny 2',
  'world of warcraft', 'final fantasy', 'zelda', 'mario kart', 'metroid prime 4',
  'nintendo switch 2', 'switch 2', 'ps5 pro', 'playstation 5', 'xbox series',
  'steam deck', 'resident evil', 'silent hill', 'doom the dark ages',
  'fable', 'avowed', 'starfield', 'fallout', 'skyrim', 'elder scrolls',
  'borderlands 4', 'mafia the old country', 'clair obscur', 'expedition 33',
  'kingdom come deliverance 2', 'split fiction', 'subnautica 2', 'ark 2',
  'path of exile 2', 'diablo 4', 'stardew valley', 'palworld', 'terraria',
  'half life', 'half-life', 'counter strike 2', 'dota 2', 'league of legends',
]

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  isArray: (name) =>
    [
      'item',
      'entry',
      'link',
      'category',
      'media:content',
      'media:thumbnail',
      'enclosure',
    ].includes(name),
})

export function fixMojibake(text = '') {
  return String(text)
    .replace(/Â·/g, '·')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\u009d|â€/g, '"')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
}

export function decodeHtmlEntities(text = '') {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    middot: '·',
    bull: '•',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
  }

  return fixMojibake(String(text))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
}

export function stripHtml(text = '') {
  return decodeHtmlEntities(String(text))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanTitle(raw = '', source = '') {
  let title = stripHtml(raw)
  if (source) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    title = title.replace(new RegExp(`\\s*[-|–—:]\\s*${escaped}(?:\\.com|\\.net)?$`, 'i'), '')
  }
  title = title.replace(/\s*[-|–—]\s*(IGN|PC Gamer|GameSpot|Eurogamer(?:\.net)?|VGC|Polygon|Rock Paper Shotgun|GamesRadar\+?|Kotaku|Push Square|Pure Xbox)$/i, '')
  return title.trim()
}

export function cleanSummary(raw = '', maxLength = 160) {
  const plain = stripHtml(raw)
  if (!plain) return ''
  if (plain.length <= maxLength) return plain
  const sliced = plain.slice(0, maxLength - 1)
  const lastSpace = sliced.lastIndexOf(' ')
  const cut = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return `${cut.replace(/[.,;:\-–—\s]+$/, '')}…`
}

export function stripTrackingParams(rawUrl = '') {
  const trimmed = decodeHtmlEntities(String(rawUrl)).trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase()
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export function hashId(link = '') {
  return createHash('sha256').update(String(link)).digest('hex').slice(0, 16)
}

export function normalizeDate(raw = '') {
  const str = String(raw || '').trim()
  if (!str) return null
  const ms = Date.parse(str)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function getText(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node === 'object') {
    if (typeof node['#text'] === 'string' || typeof node['#text'] === 'number') {
      return String(node['#text'])
    }
  }
  return ''
}

function extractLink(item) {
  if (!item) return ''
  const links = Array.isArray(item.link) ? item.link : item.link ? [item.link] : []
  for (const entry of links) {
    if (typeof entry === 'string') {
      const cleaned = stripTrackingParams(entry)
      if (cleaned) return cleaned
    } else if (entry && typeof entry === 'object') {
      const rel = String(entry['@_rel'] || 'alternate').toLowerCase()
      if (rel === 'alternate' && entry['@_href']) {
        const cleaned = stripTrackingParams(entry['@_href'])
        if (cleaned) return cleaned
      }
    }
  }
  for (const entry of links) {
    if (entry && typeof entry === 'object' && entry['@_href']) {
      const cleaned = stripTrackingParams(entry['@_href'])
      if (cleaned) return cleaned
    }
  }
  return ''
}

function sanitizeHttpsImage(url) {
  if (!url || typeof url !== 'string') return null
  const decoded = decodeHtmlEntities(url).trim()
  try {
    const parsed = new URL(decoded)
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function extractImage(item) {
  const mediaContents = Array.isArray(item['media:content']) ? item['media:content'] : []
  for (const mc of mediaContents) {
    const url = mc?.['@_url']
    const type = String(mc?.['@_type'] || '').toLowerCase()
    const medium = String(mc?.['@_medium'] || '').toLowerCase()
    if (url && (!type || type.startsWith('image/') || medium === 'image')) {
      const safe = sanitizeHttpsImage(url)
      if (safe) return safe
    }
  }

  const thumbnails = Array.isArray(item['media:thumbnail']) ? item['media:thumbnail'] : []
  for (const thumb of thumbnails) {
    const safe = sanitizeHttpsImage(thumb?.['@_url'])
    if (safe) return safe
  }

  const enclosures = Array.isArray(item.enclosure) ? item.enclosure : []
  for (const enc of enclosures) {
    const type = String(enc?.['@_type'] || '').toLowerCase()
    if (enc?.['@_url'] && (!type || type.startsWith('image/'))) {
      const safe = sanitizeHttpsImage(enc['@_url'])
      if (safe) return safe
    }
  }

  const htmlCandidates = [
    getText(item['content:encoded']),
    getText(item.description),
    getText(item.content),
    getText(item.summary),
  ]
  for (const html of htmlCandidates) {
    if (!html) continue
    const imgMatch = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
    if (imgMatch?.[1]) {
      const safe = sanitizeHttpsImage(imgMatch[1])
      if (safe) return safe
    }
  }

  return null
}

function detectPlatformsFromText(text = '') {
  const lower = String(text).toLowerCase()
  const found = []
  if (/\b(pc|steam|windows|epic games store|steam deck)\b/.test(lower)) found.push('PC')
  if (/\b(playstation|ps5|ps4|psvr|sony)\b/.test(lower)) found.push('PlayStation')
  if (/\b(xbox|series x|series s|game pass)\b/.test(lower)) found.push('Xbox')
  if (/\b(nintendo switch|switch 2|switch)\b/.test(lower)) found.push('Switch')
  return found
}

export function extractPlatforms(categories = [], title = '') {
  const catText = (Array.isArray(categories) ? categories : [categories])
    .map((c) => (typeof c === 'object' ? c?.['@_term'] || getText(c) : getText(c)))
    .filter(Boolean)
    .join(' ')

  const fromCats = detectPlatformsFromText(catText)
  if (fromCats.length > 0) return [...new Set(fromCats)]

  const fromTitle = detectPlatformsFromText(title)
  return [...new Set(fromTitle)]
}

export function parseFeedXml(xml, source = '', limit = 20) {
  if (!xml || typeof xml !== 'string') return []
  let parsed
  try {
    parsed = xmlParser.parse(xml)
  } catch {
    return []
  }

  const rssItems = parsed?.rss?.channel?.item || parsed?.['rdf:RDF']?.item || []
  const atomEntries = parsed?.feed?.entry || []
  const rawItems = rssItems.length > 0 ? rssItems : atomEntries

  return rawItems
    .slice(0, limit)
    .map((item) => {
      const title = cleanTitle(getText(item.title), source)
      const link = extractLink(item)
      const rawDate =
        getText(item.pubDate) ||
        getText(item.published) ||
        getText(item.updated) ||
        getText(item['dc:date'])
      const publishedAt = normalizeDate(rawDate)
      const rawSummary = getText(item.description) || getText(item.summary)
      const summary = cleanSummary(rawSummary, 160)
      const image = extractImage(item)
      const platforms = extractPlatforms(item.category, title)

      return {
        id: link ? hashId(link) : '',
        title,
        link,
        source,
        publishedAt,
        image,
        summary,
        platforms,
      }
    })
    .filter((article) => article.title && article.link && article.publishedAt)
}

export function isShoppingArticle(article, blocklist = SHOPPING_BLOCKLIST) {
  const haystack = `${article.title || ''} ${article.summary || ''}`.toLowerCase()
  return blocklist.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(haystack)
    return haystack.includes(String(pattern).toLowerCase())
  })
}

export function getSignificantWords(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

export function computeTopicKey(title = '') {
  const words = getSignificantWords(title)
  if (words.length === 0) return 'general'
  return [...new Set(words)].slice(0, 6).sort().join('-')
}

function findKnownGame(title = '') {
  const lower = String(title).toLowerCase()
  return KNOWN_GAMES.find((name) => lower.includes(name)) || null
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function deduplicateArticles(articles) {
  const byLink = new Map()
  for (const article of articles) {
    const existing = byLink.get(article.link)
    if (!existing) {
      byLink.set(article.link, article)
    } else if (!existing.image && article.image) {
      byLink.set(article.link, article)
    }
  }

  const deduped = []
  const wordSets = []
  for (const article of byLink.values()) {
    const words = new Set(getSignificantWords(article.title))
    const normTitle = [...words].join(' ')
    const isNearDuplicate = deduped.some((other, idx) => {
      const otherNorm = [...wordSets[idx]].join(' ')
      if (normTitle && normTitle === otherNorm) return true
      return jaccardSimilarity(words, wordSets[idx]) >= 0.85
    })
    if (!isNearDuplicate) {
      deduped.push(article)
      wordSets.push(words)
    }
  }
  return deduped
}

export function clusterAndRankNews(rawArticles, { now = Date.now(), targetCount = 15 } = {}) {
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000
  const recentWindowMs = 72 * 60 * 60 * 1000

  const valid = rawArticles.filter((article) => {
    if (!article?.title || !article?.link || !article?.publishedAt) return false
    const ts = Date.parse(article.publishedAt)
    if (!Number.isFinite(ts)) return false
    const ageMs = now - ts
    if (ageMs < -60 * 60 * 1000 || ageMs > maxAgeMs) return false
    if (isShoppingArticle(article)) return false
    return true
  })

  const unique = deduplicateArticles(valid)

  // Build topic clusters
  const clusters = []
  for (const article of unique) {
    const words = new Set(getSignificantWords(article.title))
    const knownGame = findKnownGame(article.title)

    let matchedCluster = null
    for (const cluster of clusters) {
      if (knownGame && cluster.knownGame && knownGame === cluster.knownGame) {
        matchedCluster = cluster
        break
      }
      if (jaccardSimilarity(words, cluster.words) >= 0.5) {
        matchedCluster = cluster
        break
      }
    }

    if (matchedCluster) {
      matchedCluster.articles.push(article)
      for (const w of words) matchedCluster.words.add(w)
      if (!matchedCluster.knownGame && knownGame) matchedCluster.knownGame = knownGame
    } else {
      clusters.push({
        topicKey: computeTopicKey(article.title),
        knownGame,
        words,
        articles: [article],
      })
    }
  }

  // Score each article using cluster's 72h source coverage
  const scored = []
  for (const cluster of clusters) {
    const recentSources = new Set(
      cluster.articles
        .filter((a) => now - Date.parse(a.publishedAt) <= recentWindowMs)
        .map((a) => a.source)
    )
    const coverageCount = Math.max(1, recentSources.size)

    for (const article of cluster.articles) {
      const ageMs = Math.max(0, now - Date.parse(article.publishedAt))
      const ageHours = ageMs / 3600000
      const recency = Math.exp(-ageHours / 24) * 4
      let score =
        coverageCount * 3 +
        recency +
        (article.image ? 1 : 0) +
        (article.summary ? 0.5 : 0)

      if (ageHours > 72) {
        score *= 0.4
      }

      scored.push({
        ...article,
        topicKey: cluster.topicKey,
        coverageCount,
        stale: ageHours > 72,
        _score: score,
      })
    }
  }

  // Sort by score descending (tie-break: image first, then newer)
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    if (Boolean(b.image) !== Boolean(a.image)) return b.image ? 1 : -1
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  })

  const recentPool = scored.filter((a) => !a.stale)
  const stalePool = scored.filter((a) => a.stale)

  const selected = []
  const selectedIds = new Set()
  const topicCounts = new Map()
  const sourceCounts = new Map()

  function canPick(item) {
    if (selectedIds.has(item.id)) return false
    if ((topicCounts.get(item.topicKey) || 0) >= 2) return false
    if ((sourceCounts.get(item.source) || 0) >= 3) return false
    return true
  }

  function pick(item) {
    selected.push(item)
    selectedIds.add(item.id)
    topicCounts.set(item.topicKey, (topicCounts.get(item.topicKey) || 0) + 1)
    sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1)
  }

  // Top 5 slots: require image when possible from recent pool
  for (const item of recentPool) {
    if (selected.length >= 5) break
    if (item.image && canPick(item)) pick(item)
  }

  // Fill remaining up to targetCount from recent pool
  for (const item of recentPool) {
    if (selected.length >= targetCount) break
    if (canPick(item)) pick(item)
  }

  // If fewer than targetCount, fill from stale pool (prefer images for top 5 if still under 5)
  if (selected.length < 5) {
    for (const item of stalePool) {
      if (selected.length >= 5) break
      if (item.image && canPick(item)) pick(item)
    }
  }

  for (const item of stalePool) {
    if (selected.length >= targetCount) break
    if (canPick(item)) pick(item)
  }

  return selected
    .sort((a, b) => {
      // Keep top 5 image preference if possible while ordering by score
      return b._score - a._score
    })
    .map(({ _score, ...article }) => article)
}

export async function fetchFeedWithRetry(url, { timeoutMs = 10000, fetchImpl = fetch } = {}) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      return new TextDecoder('utf-8').decode(buffer)
    } catch (error) {
      clearTimeout(timer)
      lastError = error
    }
  }
  throw lastError
}

export async function collectNewsSnapshot({
  feeds = NEWS_FEEDS,
  now = Date.now(),
  fetchImpl = fetch,
  timeoutMs = 10000,
} = {}) {
  const succeededSources = []
  const failedSources = []

  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const xml = await fetchFeedWithRetry(feed.url, { timeoutMs, fetchImpl })
        const items = parseFeedXml(xml, feed.source, feed.limit || 20)
        if (items.length === 0) {
          failedSources.push({ source: feed.source, reason: '0 valid items parsed' })
          return []
        }
        succeededSources.push(feed.source)
        return items
      } catch (error) {
        failedSources.push({ source: feed.source, reason: error.message || 'fetch failed' })
        return []
      }
    })
  )

  const articles = clusterAndRankNews(results.flat(), { now, targetCount: 15 })

  return {
    generatedAt: new Date(now).toISOString(),
    sources: succeededSources,
    failedSources,
    articles,
  }
}
