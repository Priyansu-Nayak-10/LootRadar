import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { collectNewsSnapshot } from './lib/news.mjs'

const USER_AGENT = 'WishRadar/1.0 (free portfolio project)'
const DATA_DIR = new URL('../public/data/', import.meta.url)

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`)
  return response.json()
}

async function saveJson(filename, value, targetDir = DATA_DIR) {
  await writeFile(
    new URL(filename, targetDir),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  )
}

export async function runNewsSnapshot({ outDir = DATA_DIR } = {}) {
  await mkdir(outDir, { recursive: true })
  const snapshot = await collectNewsSnapshot()

  if (snapshot.failedSources.length > 0) {
    for (const failed of snapshot.failedSources) {
      console.warn(`News feed failed (${failed.source}): ${failed.reason}`)
    }
  }

  if (snapshot.articles.length === 0) {
    console.warn('All news sources failed or returned 0 valid articles. Keeping previous gaming-news.json untouched.')
    return snapshot
  }

  await saveJson(
    'gaming-news.json',
    {
      generatedAt: snapshot.generatedAt,
      sources: snapshot.sources,
      articles: snapshot.articles,
    },
    outDir
  )

  return snapshot
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })

  const [freeGamesRes, dealsRes, storesRes, alwaysFreeRes] = await Promise.allSettled([
    fetchJson('https://www.gamerpower.com/api/giveaways?type=game'),
    fetchJson(
      'https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=Savings&desc=0'
    ),
    fetchJson('https://www.cheapshark.com/api/1.0/stores'),
    fetchJson('https://www.freetogame.com/api/games'),
  ])

  let cleanFreeGames = []
  if (freeGamesRes.status === 'fulfilled' && Array.isArray(freeGamesRes.value)) {
    cleanFreeGames = freeGamesRes.value
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

    await saveJson('gamerpower-free-games.json', {
      generatedAt: new Date().toISOString(),
      source: 'GamerPower',
      sourceUrl: 'https://www.gamerpower.com',
      games: cleanFreeGames,
    })
  } else {
    console.warn('GamerPower fetch failed or returned non-array:', freeGamesRes.reason?.message || 'unknown error')
  }

  let deals = []
  let activeStores = []
  if (dealsRes.status === 'fulfilled' && Array.isArray(dealsRes.value)) {
    deals = dealsRes.value
    if (storesRes.status === 'fulfilled' && Array.isArray(storesRes.value)) {
      activeStores = storesRes.value
        .filter((store) => Number(store.isActive) === 1)
        .map((store) => ({
          storeID: store.storeID,
          storeName: store.storeName,
        }))
    }

    await saveJson('cheapshark-deals.json', {
      generatedAt: new Date().toISOString(),
      source: 'CheapShark',
      sourceUrl: 'https://www.cheapshark.com',
      stores: activeStores,
      deals,
    })
  } else {
    console.warn('CheapShark deals fetch failed:', dealsRes.reason?.message || 'unknown error')
  }

  let cleanAlwaysFreeGames = []
  if (alwaysFreeRes.status === 'fulfilled' && Array.isArray(alwaysFreeRes.value)) {
    cleanAlwaysFreeGames = alwaysFreeRes.value
      .slice(0, 120)
      .map((game) => ({
        id: game.id,
        title: game.title,
        description: game.short_description,
        genre: game.genre,
        platform: game.platform,
        publisher: game.publisher,
        developer: game.developer,
        releaseDate: game.release_date,
        thumbnail: game.thumbnail,
        gameUrl: game.game_url,
        profileUrl: game.freetogame_profile_url,
      }))

    await saveJson('always-free-games.json', {
      generatedAt: new Date().toISOString(),
      source: 'FreeToGame',
      sourceUrl: 'https://www.freetogame.com',
      games: cleanAlwaysFreeGames,
    })
  } else {
    console.warn('FreeToGame fetch failed:', alwaysFreeRes.reason?.message || 'unknown error')
  }

  const skipNews = process.argv.includes('--skip-news')
  const newsSnapshot = skipNews ? { articles: [] } : await runNewsSnapshot()

  console.log(
    `Saved ${cleanFreeGames.length} free games, ${deals.length} deals, ${activeStores.length} stores, ${cleanAlwaysFreeGames.length} always-free games, and ${newsSnapshot.articles.length} news stories`
  )
}

const args = process.argv.slice(2)
const newsOnly = args.includes('--news-only')
const outIdx = args.indexOf('--out')
const outArg = outIdx >= 0 ? args[outIdx + 1] : null

if (newsOnly) {
  const targetDir = outArg
    ? pathToFileURL(outArg.endsWith('/') || outArg.endsWith('\\') ? outArg : `${outArg}/`)
    : DATA_DIR
  runNewsSnapshot({ outDir: targetDir })
    .then((snapshot) => {
      console.log(
        `News-only snapshot: ${snapshot.articles.length} stories from ${snapshot.sources.length} sources (${snapshot.failedSources.length} failed)`
      )
    })
    .catch((error) => {
      console.warn('News-only snapshot warning:', error.message)
    })
} else {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
