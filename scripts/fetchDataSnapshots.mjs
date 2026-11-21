import { mkdir, writeFile } from 'node:fs/promises'

const USER_AGENT = 'LootRadar/1.0 (free portfolio project)'
const DATA_DIR = new URL('../public/data/', import.meta.url)

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`)
  return response.text()
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstMatch(xml, pattern) {
  return xml.match(pattern)?.[1]?.trim() || ''
}

function parseRssItems(xml, sourceLimit) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    .slice(0, sourceLimit)
    .map((match) => {
      const item = match[0]
      const title = decodeXml(firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i))
      const link = decodeXml(firstMatch(item, /<link[^>]*>([\s\S]*?)(?:<\/link>|$)/i))
      const description = decodeXml(
        firstMatch(item, /<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/i)
      )
      const publishedAt =
        firstMatch(item, /<(?:pubDate|dc:date|published)[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date|published)>/i) ||
        ''
      const mediaUrl =
        firstMatch(item, /<media:content[^>]*url=["']([^"']+)["']/i) ||
        firstMatch(item, /<media:thumbnail[^>]*url=["']([^"']+)["']/i) ||
        firstMatch(item, /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)

      return {
        id: `${link}|${publishedAt}`,
        title,
        link,
        summary: description.slice(0, 300),
        publishedAt,
        image: mediaUrl,
        source: '',
      }
    })
    .filter((article) => article.title && article.link)
}

async function saveJson(filename, value) {
  await writeFile(
    new URL(filename, DATA_DIR),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  )
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })

  const [freeGames, deals, stores] = await Promise.all([
    fetchJson('https://www.gamerpower.com/api/giveaways?type=game'),
    fetchJson(
      'https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=Savings&desc=1&upperPrice=15'
    ),
    fetchJson('https://www.cheapshark.com/api/1.0/stores'),
  ])

  const cleanFreeGames = freeGames
    .filter((game) => game.status === 'Active')
    .map((game) => ({
      id: game.id,
      title: game.title,
      platforms: game.platforms,
      thumbnail: game.thumbnail,
      worth: game.worth,
      end_date: game.end_date,
      open_giveaway_url: game.open_giveaway_url,
      gamerpower_url: game.gamerpower_url,
    }))

  const activeStores = stores
    .filter((store) => Number(store.isActive) === 1)
    .map((store) => ({
      storeID: store.storeID,
      storeName: store.storeName,
    }))

  await saveJson('gamerpower-free-games.json', {
    generatedAt: new Date().toISOString(),
    source: 'GamerPower',
    sourceUrl: 'https://www.gamerpower.com',
    games: cleanFreeGames,
  })

  await saveJson('cheapshark-deals.json', {
    generatedAt: new Date().toISOString(),
    source: 'CheapShark',
    sourceUrl: 'https://www.cheapshark.com',
    stores: activeStores,
    deals,
  })

  const feeds = [
    { source: 'IGN', url: 'https://www.ign.com/rss/v2/articles/feed', limit: 12 },
    { source: 'PC Gamer', url: 'https://www.pcgamer.com/feeds.xml', limit: 12 },
    { source: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', limit: 12 },
  ]

  const newsResults = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const xml = await fetchText(feed.url)
        return parseRssItems(xml, feed.limit).map((article) => ({
          ...article,
          source: feed.source,
        }))
      } catch (error) {
        console.error(`News feed failed: ${feed.source}: ${error.message}`)
        return []
      }
    })
  )

  const articles = newsResults
    .flat()
    .sort((first, second) => new Date(second.publishedAt) - new Date(first.publishedAt))
    .slice(0, 36)

  await saveJson('gaming-news.json', {
    generatedAt: new Date().toISOString(),
    source: 'LootRadar RSS aggregation',
    articles,
  })

  console.log(
    `Saved ${cleanFreeGames.length} free games, ${deals.length} deals, ${activeStores.length} stores, and ${articles.length} news stories`
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
