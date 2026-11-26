import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFeedXml,
  normalizeDate,
  cleanSummary,
  stripTrackingParams,
  isShoppingArticle,
  clusterAndRankNews,
  collectNewsSnapshot,
  parseGamebeeperJson,
} from '../../../scripts/lib/news.mjs'

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>IGN</title>
    <item>
      <title>GTA 6 Trailer 2 Breaks Records - IGN</title>
      <link>https://www.ign.com/articles/gta-6-trailer-2?utm_source=rss&amp;fbclid=12345</link>
      <pubDate>Tue, 24 Nov 2026 12:00:00 +0000</pubDate>
      <category>PS5</category>
      <category>Xbox Series X</category>
      <description><![CDATA[<p>Rockstar&#39;s <strong>GTA 6</strong> trailer &amp; analysis Â· huge numbers.</p>]]></description>
      <media:content url="https://assets.ign.com/gta6.jpg" medium="image" />
    </item>
    <item>
      <title>No Summary Item</title>
      <link>https://www.ign.com/articles/no-summary</link>
      <pubDate>Tue, 24 Nov 2026 11:00:00 +0000</pubDate>
      <content:encoded><![CDATA[<p>Body image only <img src="https://assets.ign.com/from-html.png" /></p>]]></content:encoded>
    </item>
    <item>
      <title>HTTP Image Rejected</title>
      <link>https://www.ign.com/articles/http-img</link>
      <pubDate>Tue, 24 Nov 2026 10:00:00 +0000</pubDate>
      <enclosure url="http://assets.ign.com/insecure.jpg" type="image/jpeg" />
    </item>
  </channel>
</rss>`

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Eurogamer</title>
  <entry>
    <title>Elden Ring Nightreign Gets Release Date | Eurogamer.net</title>
    <link rel="alternate" href="https://www.eurogamer.net/elden-ring-nightreign?utm_medium=feed&amp;gclid=abc" />
    <updated>2026-11-24T13:30:00Z</updated>
    <category term="PC" />
    <summary type="html">&lt;p&gt;FromSoftware confirms the release window for Nightreign across PC and consoles with a brand new co-op mode.&lt;/p&gt;</summary>
    <media:thumbnail url="https://assets.eurogamer.net/nightreign.webp" />
  </entry>
</feed>`

test('parseFeedXml parses RSS 2.0 and Atom fixtures accurately', () => {
  const rssItems = parseFeedXml(RSS_FIXTURE, 'IGN', 20)
  assert.equal(rssItems.length, 3)
  assert.equal(rssItems[0].title, 'GTA 6 Trailer 2 Breaks Records')
  assert.equal(rssItems[0].link, 'https://www.ign.com/articles/gta-6-trailer-2')
  assert.equal(rssItems[0].publishedAt, '2026-11-24T12:00:00.000Z')
  assert.equal(rssItems[0].image, 'https://assets.ign.com/gta6.jpg')
  assert.deepEqual(rssItems[0].platforms, ['PlayStation', 'Xbox'])
  assert.ok(rssItems[0].summary.includes("Rockstar's GTA 6 trailer & analysis · huge numbers."))

  // Item 2: no description -> empty summary, image extracted from content:encoded
  assert.equal(rssItems[1].summary, '')
  assert.equal(rssItems[1].image, 'https://assets.ign.com/from-html.png')

  // Item 3: http image rejected -> null
  assert.equal(rssItems[2].image, null)

  const atomItems = parseFeedXml(ATOM_FIXTURE, 'Eurogamer', 20)
  assert.equal(atomItems.length, 1)
  assert.equal(atomItems[0].title, 'Elden Ring Nightreign Gets Release Date')
  assert.equal(atomItems[0].link, 'https://www.eurogamer.net/elden-ring-nightreign')
  assert.equal(atomItems[0].publishedAt, '2026-11-24T13:30:00.000Z')
  assert.equal(atomItems[0].image, 'https://assets.eurogamer.net/nightreign.webp')
  assert.deepEqual(atomItems[0].platforms, ['PC'])
})

test('normalizeDate converts valid dates to ISO 8601 UTC and rejects invalid dates', () => {
  assert.equal(normalizeDate('Tue, 24 Nov 2026 12:00:00 +0000'), '2026-11-24T12:00:00.000Z')
  assert.equal(normalizeDate('2026-11-24T15:00:00+02:00'), '2026-11-24T13:00:00.000Z')
  assert.equal(normalizeDate('not-a-date'), null)
  assert.equal(normalizeDate(''), null)
})

test('cleanSummary strips HTML, decodes entities, fixes mojibake, and caps at 160 chars', () => {
  const longHtml = '<p>This is a &quot;very&quot; long summary about gaming Â· ' + 'word '.repeat(50) + '</p>'
  const cleaned = cleanSummary(longHtml, 160)
  assert.ok(cleaned.length <= 160)
  assert.ok(cleaned.endsWith('…'))
  assert.ok(!cleaned.includes('<p>'))
  assert.ok(cleaned.includes('"very"'))
  assert.ok(cleaned.includes('·'))
  assert.equal(cleanSummary(''), '')
})

test('stripTrackingParams removes utm and ad tracking parameters', () => {
  assert.equal(
    stripTrackingParams('https://example.com/news?id=42&utm_source=x&utm_campaign=y&fbclid=z#top'),
    'https://example.com/news?id=42'
  )
})

test('isShoppingArticle filters out deals, coupons, and affiliate posts', () => {
  assert.equal(isShoppingArticle({ title: 'Best Black Friday PS5 Deals' }), true)
  assert.equal(isShoppingArticle({ title: 'Best gaming headsets under $100' }), true)
  assert.equal(isShoppingArticle({ title: 'Deals: Save 40% on SSDs' }), true)
  assert.equal(isShoppingArticle({ title: 'Where to buy Nintendo Switch 2' }), true)
  assert.equal(isShoppingArticle({ title: 'Hollow Knight Silksong gets new gameplay trailer' }), false)
})

test('clusterAndRankNews groups topics, counts unique sources in 72h, and orders by score', () => {
  const now = Date.parse('2026-11-25T12:00:00Z')
  const articles = [
    {
      id: '1',
      title: 'GTA 6 Trailer 2 Drops With New Gameplay Details',
      link: 'https://ign.com/1',
      source: 'IGN',
      publishedAt: '2026-11-25T10:00:00Z',
      image: 'https://ign.com/1.jpg',
      summary: 'Summary 1',
      platforms: ['PlayStation'],
    },
    {
      id: '2',
      title: 'GTA 6 Trailer 2 Reveals Vice City Locations',
      link: 'https://gamespot.com/2',
      source: 'GameSpot',
      publishedAt: '2026-11-25T09:00:00Z',
      image: 'https://gamespot.com/2.jpg',
      summary: 'Summary 2',
      platforms: ['Xbox'],
    },
    {
      id: '3',
      title: 'GTA 6 Trailer 2 Breakdown and Frame Analysis',
      link: 'https://eurogamer.net/3',
      source: 'Eurogamer',
      publishedAt: '2026-11-25T08:00:00Z',
      image: 'https://eurogamer.net/3.jpg',
      summary: 'Summary 3',
      platforms: ['PC'],
    },
    {
      id: '4',
      title: 'Indie Puzzle Game Launches Today on Steam',
      link: 'https://pcgamer.com/4',
      source: 'PC Gamer',
      publishedAt: '2026-11-25T11:30:00Z',
      image: 'https://pcgamer.com/4.jpg',
      summary: 'Summary 4',
      platforms: ['PC'],
    },
  ]

  const ranked = clusterAndRankNews(articles, { now, targetCount: 10 })
  assert.equal(ranked[0].coverageCount, 3)
  assert.equal(ranked[0].source, 'IGN')
  // Topic cap: max 2 stories per topicKey even though 3 covered GTA 6
  const gtaStories = ranked.filter((a) => a.coverageCount === 3)
  assert.equal(gtaStories.length, 2)
  assert.equal(ranked.length, 3)
})

test('clusterAndRankNews enforces per-source cap of 3 and stale fill rule', () => {
  const now = Date.parse('2026-11-25T12:00:00Z')
  const articles = []
  // 5 recent articles from IGN with distinct topics -> should cap at 3
  const topics = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
  for (let i = 0; i < 5; i++) {
    articles.push({
      id: `ign-${i}`,
      title: `Unique Story ${topics[i]} Announced`,
      link: `https://ign.com/story-${i}`,
      source: 'IGN',
      publishedAt: new Date(now - i * 3600000).toISOString(),
      image: `https://ign.com/${i}.jpg`,
      summary: 'Summary',
      platforms: [],
    })
  }
  // 8 older (4 days old = stale) articles from other sources to fill up to 10
  const staleTopics = ['Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike']
  for (let i = 0; i < 8; i++) {
    articles.push({
      id: `stale-${i}`,
      title: `Older Story ${staleTopics[i]} Revealed`,
      link: `https://source${i}.com/story-${i}`,
      source: `Source${i}`,
      publishedAt: new Date(now - 96 * 3600000 - i * 3600000).toISOString(),
      image: `https://source${i}.com/${i}.jpg`,
      summary: 'Summary',
      platforms: [],
    })
  }

  const ranked = clusterAndRankNews(articles, { now, targetCount: 10 })
  assert.equal(ranked.length, 10)
  const ignCount = ranked.filter((a) => a.source === 'IGN').length
  assert.equal(ignCount, 3)
  const staleCount = ranked.filter((a) => a.stale === true).length
  assert.equal(staleCount, 7)
})

test('collectNewsSnapshot returns empty articles when all feeds fail (never writes empty)', async () => {
  const failingFetch = async () => {
    throw new Error('Network unreachable')
  }
  const result = await collectNewsSnapshot({
    feeds: [{ source: 'IGN', url: 'https://example.com/rss', limit: 5 }],
    fetchImpl: failingFetch,
    timeoutMs: 100,
  })
  assert.equal(result.articles.length, 0)
  assert.equal(result.sources.length, 0)
  assert.equal(result.failedSources.length, 1)
})

test('parseGamebeeperJson normalizes gamebeeper feed items and tolerates missing fields', () => {
  const jsonFixture = [
    {
      title: 'Hollow Knight: Silksong Update Shared by Team Cherry',
      url: 'https://gamebeeper.gg/articles/silksong-update?utm_source=feed&fbclid=xyz',
      publishedAt: '2026-11-25T14:00:00Z',
      description: 'Team Cherry shares a new development update for Silksong on PC and Switch.',
      thumbnail: 'https://gamebeeper.gg/images/silksong.jpg',
      tags: ['PC', 'Switch'],
      source: 'GameBeeper',
    },
    {
      title: 'Sponsored Giveaway: Win a GPU',
      link: 'https://gamebeeper.gg/sponsored-giveaway',
      published: '2026-11-25T15:00:00Z',
      sponsored: true,
    },
    {
      title: 'Minimal Article With Missing Optional Fields',
      link: 'https://gamebeeper.gg/minimal-article',
      date: '2026-11-25T12:00:00Z',
    },
    {
      title: 'Invalid Article Without Date or Link',
      publishedAt: 'not-a-date',
    },
  ]

  const articles = parseGamebeeperJson(jsonFixture, 'GameBeeper', 10)
  assert.equal(articles.length, 2)

  // Item 1: full details
  assert.equal(articles[0].title, 'Hollow Knight: Silksong Update Shared by Team Cherry')
  assert.equal(articles[0].link, 'https://gamebeeper.gg/articles/silksong-update')
  assert.equal(articles[0].publishedAt, '2026-11-25T14:00:00.000Z')
  assert.equal(articles[0].image, 'https://gamebeeper.gg/images/silksong.jpg')
  assert.equal(articles[0].source, 'GameBeeper')
  assert.deepEqual(articles[0].platforms, ['PC', 'Switch'])
  assert.ok(articles[0].summary.includes('Team Cherry shares a new development update'))

  // Item 2: sponsored was skipped, item 3 is minimal
  assert.equal(articles[1].title, 'Minimal Article With Missing Optional Fields')
  assert.equal(articles[1].link, 'https://gamebeeper.gg/minimal-article')
  assert.equal(articles[1].image, null)
  assert.equal(articles[1].summary, '')
  assert.deepEqual(articles[1].platforms, [])

  // Tolerates string JSON, object wrapper, null, or invalid JSON string
  const fromString = parseGamebeeperJson(JSON.stringify(jsonFixture))
  assert.equal(fromString.length, 2)

  const fromObjectWrapper = parseGamebeeperJson({ articles: jsonFixture })
  assert.equal(fromObjectWrapper.length, 2)

  assert.deepEqual(parseGamebeeperJson(null), [])
  assert.deepEqual(parseGamebeeperJson('invalid-json'), [])
  assert.deepEqual(parseGamebeeperJson({}), [])
})
