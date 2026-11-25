import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanTitle,
  isMobile,
  normalizeStore,
  parseEndDate,
  isActive,
  formatTimeLeft,
  formatStartsIn,
  parseWorthUsd,
  formatWorthInr,
  dedupe,
  mergeFreeSources,
  sortFreeGames,
  parseFreeParams,
  serializeFreeParams,
} from '../freeGames.js'

describe('freeGames helpers', () => {
  describe('cleanTitle', () => {
    it('strips (Epic Games) Giveaway suffix', () => {
      assert.equal(
        cleanTitle('Mark of the Deep (Epic Games) Giveaway'),
        'Mark of the Deep'
      )
    })

    it('strips (Steam) Giveaway and Free Steam Key', () => {
      assert.equal(cleanTitle('Half-Life 2 (Steam) Giveaway'), 'Half-Life 2')
      assert.equal(cleanTitle('Portal 2 - Free Steam Key'), 'Portal 2')
    })

    it('strips (GOG), (Itch.io), (IndieGala) tags', () => {
      assert.equal(cleanTitle('The Witcher 3 (GOG) Giveaway'), 'The Witcher 3')
      assert.equal(cleanTitle('Indie Gem (Itch.io)'), 'Indie Gem')
      assert.equal(cleanTitle('Cave Story [IndieGala] Giveaway'), 'Cave Story')
    })

    it('strips Free Games Bundle noise and trailing punctuation', () => {
      assert.equal(cleanTitle('Epic Winter - Free Games Bundle'), 'Epic Winter')
      assert.equal(cleanTitle('Cyberpunk 2077 - Giveaway'), 'Cyberpunk 2077')
    })

    it('handles empty or non-string titles gracefully', () => {
      assert.equal(cleanTitle(''), '')
      assert.equal(cleanTitle(null), '')
      assert.equal(cleanTitle(undefined), '')
    })
  })

  describe('isMobile', () => {
    it('returns true for mobile giveaways in platforms', () => {
      assert.equal(isMobile({ platforms: 'Android, iOS' }), true)
      assert.equal(isMobile({ platforms: 'iOS' }), true)
      assert.equal(isMobile({ platforms: 'Android' }), true)
      assert.equal(isMobile({ platforms: 'iPhone, iPad' }), true)
    })

    it('returns true when title contains (Mobile)', () => {
      assert.equal(isMobile({ title: 'Lonesome Village (Mobile) Giveaway', platforms: 'PC' }), true)
    })

    it('returns false for PC and console games', () => {
      assert.equal(isMobile({ platforms: 'PC, Steam' }), false)
      assert.equal(isMobile({ platforms: 'PC, Epic Games Store' }), false)
      assert.equal(isMobile({ platforms: 'PlayStation 5, Xbox Series X' }), false)
    })

    it('handles null / undefined safely', () => {
      assert.equal(isMobile(null), false)
      assert.equal(isMobile({}), false)
    })
  })

  describe('normalizeStore', () => {
    it('identifies Epic games correctly', () => {
      assert.equal(normalizeStore({ platforms: 'PC, Epic Games Store' }), 'Epic')
      assert.equal(normalizeStore({ title: 'Game (Epic Games)' }), 'Epic')
    })

    it('identifies Steam games correctly', () => {
      assert.equal(normalizeStore({ platforms: 'PC, Steam' }), 'Steam')
    })

    it('identifies GOG games correctly', () => {
      assert.equal(normalizeStore({ platforms: 'PC, GOG' }), 'GOG')
    })

    it('identifies itch.io games correctly', () => {
      assert.equal(normalizeStore({ platforms: 'PC, Itch.io, DRM-Free' }), 'itch.io')
    })

    it('identifies Prime/Amazon correctly matching amazon or prime', () => {
      assert.equal(normalizeStore({ platforms: 'Amazon Games' }), 'Prime/Amazon')
      assert.equal(normalizeStore({ open_giveaway_url: 'https://gaming.amazon.com/loot' }), 'Prime/Amazon')
      assert.equal(normalizeStore({ title: 'Prime Gaming Loot' }), 'Prime/Amazon')
    })

    it('identifies Ubisoft games correctly', () => {
      assert.equal(normalizeStore({ platforms: 'Ubisoft Connect' }), 'Ubisoft')
    })

    it('falls back to Other', () => {
      assert.equal(normalizeStore({ platforms: 'DRM-Free' }), 'Other')
      assert.equal(normalizeStore(null), 'Other')
    })
  })

  describe('isActive & parseEndDate', () => {
    it('parses both GamerPower format and ISO dates', () => {
      const gp = parseEndDate('2026-11-26 16:00:00')
      const iso = parseEndDate('2026-11-26T16:00:00.000Z')
      assert.ok(gp > 0)
      assert.equal(gp, iso)
    })

    it('considers open-ended items (no end date) as active', () => {
      assert.equal(isActive({ end_date: null }), true)
      assert.equal(isActive({ end_date: 'N/A' }), true)
    })

    it('drops expired items', () => {
      const past = Date.now() - 5000
      assert.equal(isActive({ end_date: new Date(past).toISOString() }), false)
    })

    it('keeps future items', () => {
      const future = Date.now() + 100000
      assert.equal(isActive({ end_date: new Date(future).toISOString() }), true)
    })
  })

  describe('formatTimeLeft', () => {
    const now = 1700000000000

    it('returns Time TBA for open-ended giveaways', () => {
      const res = formatTimeLeft(null, now)
      assert.equal(res.text, 'Time TBA')
      assert.equal(res.isTba, true)
      assert.equal(res.urgent, false)
    })

    it('returns Ended for past giveaways', () => {
      const res = formatTimeLeft(new Date(now - 1000).toISOString(), now)
      assert.equal(res.text, 'Ended')
      assert.equal(res.urgent, true)
    })

    it('returns "Ends today" when under 12h', () => {
      const res = formatTimeLeft(new Date(now + 6 * 3600000).toISOString(), now)
      assert.equal(res.text, 'Ends today')
      assert.equal(res.urgent, true)
      assert.equal(res.isEndsToday, true)
    })

    it('returns "Xh left" when under 24h but 12h+', () => {
      const res = formatTimeLeft(new Date(now + 18 * 3600000).toISOString(), now)
      assert.equal(res.text, '18h left')
      assert.equal(res.urgent, true)
    })

    it('returns "Xd Yh left" when 24h+', () => {
      const res = formatTimeLeft(new Date(now + (3 * 86400000 + 6 * 3600000)).toISOString(), now)
      assert.equal(res.text, '3d 6h left')
      assert.equal(res.urgent, false)
    })
  })

  describe('formatStartsIn', () => {
    const now = 1700000000000

    it('formats days and hours properly', () => {
      const future = new Date(now + 2 * 86400000 + 4 * 3600000).toISOString()
      assert.equal(formatStartsIn(future, now), 'Starts in 2d 4h')
    })

    it('formats hours only when under 24h', () => {
      const future = new Date(now + 5 * 3600000).toISOString()
      assert.equal(formatStartsIn(future, now), 'Starts in 5h')
    })
  })

  describe('parseWorthUsd', () => {
    it('parses numeric values from string with dollar and currency tags', () => {
      assert.equal(parseWorthUsd('$19.99'), 19.99)
      assert.equal(parseWorthUsd('$4.99 USD'), 4.99)
      assert.equal(parseWorthUsd(29.99), 29.99)
      assert.equal(parseWorthUsd('N/A'), 0)
      assert.equal(parseWorthUsd(null), 0)
    })
  })

  describe('dedupe', () => {
    it('merges GamerPower and Epic duplicate items and prefers Epic details', () => {
      const gpItem = {
        id: 101,
        title: 'Mark of the Deep (Epic Games) Giveaway',
        thumbnail: 'https://gp.com/thumb.jpg',
        worth: '$19.99',
        end_date: '2026-11-26 16:00:00',
        open_giveaway_url: 'https://gp.com/open/mark-of-the-deep',
      }
      const epicItem = {
        id: 'epic-1',
        title: 'Mark of the Deep',
        image: 'https://cdn1.epicgames.com/mark-of-the-deep.png',
        endDate: '2026-11-26T16:00:00.000Z',
        slug: 'mark-of-the-deep',
        namespace: 'epic-namespace',
      }

      const result = dedupe([gpItem, epicItem])
      assert.equal(result.length, 1)
      assert.equal(result[0].title, 'Mark of the Deep')
      assert.equal(result[0].worthInr, 0)
      assert.equal(result[0].image, 'https://cdn1.epicgames.com/mark-of-the-deep.png')
    })

    it('merges Epic and ITAD free[] keeping Epic image/link, INR worth, and earliest end time', () => {
      const now = Date.parse('2026-11-25T10:00:00Z')
      const epicItem = {
        id: 'epic-1',
        title: 'Mark of the Deep',
        image: 'https://cdn1.epicgames.com/mark.png',
        endDate: '2026-11-28T16:00:00.000Z',
        slug: 'mark-of-the-deep',
        namespace: 'ns1',
      }
      const itadItem = {
        itadId: 'itad-1',
        title: 'Mark of the Deep',
        image: 'https://assets.isthereanydeal.com/mark.jpg',
        shop: { id: 16, name: 'Epic Game Store' },
        price: 0,
        regular: 899,
        cut: 100,
        expiry: '2026-11-26T16:00:00.000Z',
        url: 'https://isthereanydeal.com/deals/mark',
      }
      const expiredItad = {
        itadId: 'itad-old',
        title: 'Expired Game',
        shop: { id: 61, name: 'Steam' },
        price: 0,
        regular: 499,
        cut: 100,
        expiry: '2026-11-24T10:00:00.000Z',
        url: 'https://isthereanydeal.com/deals/expired',
      }

      const merged = mergeFreeSources({
        epicItems: [epicItem],
        gamerPowerItems: [],
        itadFreeItems: [itadItem, expiredItad],
        now,
      })

      assert.equal(merged.length, 1)
      assert.equal(merged[0].title, 'Mark of the Deep')
      assert.equal(merged[0].worthInr, 899)
      assert.equal(formatWorthInr(merged[0].worthInr), '₹899')
      assert.equal(merged[0].end_date, '2026-11-26T16:00:00.000Z')
      assert.equal(merged[0].open_giveaway_url, 'https://store.epicgames.com/p/mark-of-the-deep')
    })
  })

  describe('sortFreeGames', () => {
    const now = 1700000000000
    const item1 = { id: 1, title: 'Game A', worthInr: 500, end_date: new Date(now + 50000).toISOString() }
    const item2 = { id: 2, title: 'Game B', worthInr: 1500, end_date: new Date(now + 10000).toISOString() }
    const itemTba = { id: 3, title: 'Game C', worthInr: 250, end_date: null }

    it('sorts ending soonest first, with TBA last', () => {
      const sorted = sortFreeGames([item1, itemTba, item2], 'ending', now)
      assert.deepEqual(sorted.map((g) => g.title), ['Game B', 'Game A', 'Game C'])
    })

    it('sorts highest value first', () => {
      const sorted = sortFreeGames([item1, itemTba, item2], 'value', now)
      assert.deepEqual(sorted.map((g) => g.title), ['Game B', 'Game A', 'Game C'])
    })

    it('sorts recently added first by id', () => {
      const sorted = sortFreeGames([item1, item2, itemTba], 'recent', now)
      assert.deepEqual(sorted.map((g) => g.title), ['Game C', 'Game B', 'Game A'])
    })
  })

  describe('parseFreeParams and serializeFreeParams', () => {
    it('parses valid query string into object', () => {
      const parsed = parseFreeParams('?tab=claim&store=epic&sort=ending')
      assert.deepEqual(parsed, { tab: 'claim', store: 'epic', sort: 'ending' })
    })

    it('falls back to default values', () => {
      const parsed = parseFreeParams('')
      assert.deepEqual(parsed, { tab: 'claim', store: 'all', sort: 'ending' })
    })

    it('serializes state back to URL string', () => {
      const qs = serializeFreeParams({ tab: 'coming', store: 'epic', sort: 'value' })
      assert.equal(qs, '?tab=coming&store=epic&sort=value')
    })

    it('returns empty string for default state', () => {
      const qs = serializeFreeParams({ tab: 'claim', store: 'all', sort: 'ending' })
      assert.equal(qs, '')
    })
  })
})
