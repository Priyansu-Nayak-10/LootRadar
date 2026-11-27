import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanTitle,
  dedupeKey,
  freeGameMergeKey,
  isMobile,
  normalizeStore,
  parseEndDate,
  isActive,
  formatTimeLeft,
  getTimeTone,
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

  describe('freeGameMergeKey', () => {
    it('normalizes Part II vs Part 2 to identical keys', () => {
      assert.equal(
        freeGameMergeKey('Contractor: The Clean Up Part II'),
        'contractor clean up part 2'
      )
      assert.equal(
        freeGameMergeKey('Contractor: The Clean Up Part 2 (Epic Games) Giveaway'),
        'contractor clean up part 2'
      )
      assert.equal(
        freeGameMergeKey('Contractor: The Clean Up Part II'),
        freeGameMergeKey('Contractor: The Clean Up Part 2 (Epic Games) Giveaway')
      )
    })

    it('handles titles with and without punctuation and with and without "The"', () => {
      assert.equal(
        freeGameMergeKey('Contractor: The Clean Up Part II'),
        freeGameMergeKey('Contractor The Clean Up Part 2')
      )
      assert.equal(
        freeGameMergeKey('The Witcher 3: Wild Hunt'),
        freeGameMergeKey('Witcher 3 Wild Hunt')
      )
      assert.equal(
        freeGameMergeKey('Contractor: The Clean Up'),
        freeGameMergeKey('Contractor Clean Up')
      )
    })

    it('replaces standalone roman numerals I to X with digits', () => {
      assert.equal(freeGameMergeKey('Game Part I'), 'game part 1')
      assert.equal(freeGameMergeKey('Game Part II'), 'game part 2')
      assert.equal(freeGameMergeKey('Game Part III'), 'game part 3')
      assert.equal(freeGameMergeKey('Game Part IV'), 'game part 4')
      assert.equal(freeGameMergeKey('Game Part V'), 'game part 5')
      assert.equal(freeGameMergeKey('Game Part VI'), 'game part 6')
      assert.equal(freeGameMergeKey('Game Part VII'), 'game part 7')
      assert.equal(freeGameMergeKey('Game Part VIII'), 'game part 8')
      assert.equal(freeGameMergeKey('Game Part IX'), 'game part 9')
      assert.equal(freeGameMergeKey('Game Part X'), 'game part 10')
    })

    it('strips accents, trademarks, and collapses spaces', () => {
      assert.equal(freeGameMergeKey('Pokémon™ Special Edition®'), 'pokemon special edition')
      assert.equal(freeGameMergeKey('   Super   Game   Part   2   '), 'super game part 2')
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

  describe('getTimeTone', () => {
    const now = 1700000000000
    const H = 3600000

    it('returns none for null, undefined, and invalid strings', () => {
      assert.equal(getTimeTone(null, now), 'none')
      assert.equal(getTimeTone(undefined, now), 'none')
      assert.equal(getTimeTone('N/A', now), 'none')
      assert.equal(getTimeTone('not-a-date', now), 'none')
      assert.equal(getTimeTone(new Date('invalid'), now), 'none')
    })

    it('handles exact 48h, 6h, and 5h59m boundaries', () => {
      assert.equal(getTimeTone(new Date(now + 48 * H + 1).toISOString(), now), 'calm')
      assert.equal(getTimeTone(new Date(now + 48 * H).toISOString(), now), 'soon')
      assert.equal(getTimeTone(new Date(now + 6 * H).toISOString(), now), 'soon')
      assert.equal(getTimeTone(new Date(now + 5 * H + 59 * 60000).toISOString(), now), 'urgent')
      assert.equal(getTimeTone(new Date(now - 1000).toISOString(), now), 'urgent')
    })

    it('accepts Date objects and ISO strings', () => {
      assert.equal(getTimeTone(new Date(now + 72 * H), now), 'calm')
      assert.equal(getTimeTone(new Date(now + 24 * H).toISOString(), now), 'soon')
      assert.equal(getTimeTone(new Date(now + 3 * H), now), 'urgent')
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

  describe('formatWorthInr', () => {
    it('formats INR object into currency string', () => {
      assert.equal(formatWorthInr({ amount: 179, currency: 'INR' }), '₹179')
      assert.equal(formatWorthInr({ amount: 539, currency: 'INR' }), '₹539')
    })

    it('formats raw numeric INR amounts', () => {
      assert.equal(formatWorthInr(179), '₹179')
      assert.equal(formatWorthInr('179'), '₹179')
    })

    it('returns null for non-INR currencies (never shows USD as INR)', () => {
      assert.equal(formatWorthInr({ amount: 19.99, currency: 'USD' }), null)
      assert.equal(formatWorthInr({ amount: 4.99, currency: 'EUR' }), null)
    })

    it('returns null for empty, zero, or missing values', () => {
      assert.equal(formatWorthInr(null), null)
      assert.equal(formatWorthInr(undefined), null)
      assert.equal(formatWorthInr(0), null)
      assert.equal(formatWorthInr(''), null)
      assert.equal(formatWorthInr({}), null)
    })
  })

  describe('dedupe', () => {
    it('merges Part II and Part 2 and preserves official source and copies missing fields', () => {
      const gpContractor = {
        id: 3852,
        title: 'Contractor: The Clean Up Part 2 (Epic Games) Giveaway',
        platforms: 'PC, Epic Games Store',
        thumbnail: 'https://gp.com/contractor.jpg',
        worth: '$4.99',
        end_date: '2026-12-02 23:59:00',
        open_giveaway_url: 'https://gp.com/open/contractor-2',
      }
      const itadContractor = {
        itadId: 'itad-contractor',
        title: 'Contractor: The Clean Up Part II',
        platforms: 'PC, Epic Game Store',
        image: 'https://assets.itad.com/contractor.png',
        shop: { id: 16, name: 'Epic Game Store' },
        price: 0,
        regular: 179,
        cut: 100,
        currency: 'INR',
        worth: { amount: 179, currency: 'INR', source: 'Epic Game Store' },
        url: 'https://store.epicgames.com/p/contractor-the-clean-up-part-ii',
        _isItad: true,
      }

      const result = dedupe([gpContractor, itadContractor])
      assert.equal(result.length, 1)
      assert.equal(result[0].title, 'Contractor: The Clean Up Part II')
      assert.equal(result[0].worthInr, 179)
      assert.deepEqual(result[0].worth, { amount: 179, currency: 'INR', source: 'Epic Game Store' })
      assert.equal(formatWorthInr(result[0].worth), '₹179')
      // Copied missing end_date from dropped entry
      assert.equal(result[0].end_date, '2026-12-02 23:59:00')
      assert.equal(result[0].thumbnail, 'https://assets.itad.com/contractor.png')
    })

    it('keeps earlier end time when both entries qualify', () => {
      const itemEarly = {
        id: 'epic-early',
        title: 'Game Double',
        namespace: 'ns-early',
        startDate: '2026-11-20T00:00:00Z',
        endDate: '2026-11-28T16:00:00Z',
        slug: 'game-double',
        image: 'img-early.jpg',
      }
      const itemLate = {
        id: 'epic-late',
        title: 'Game Double',
        namespace: 'ns-late',
        startDate: '2026-11-20T00:00:00Z',
        endDate: '2026-12-02T16:00:00Z',
        slug: 'game-double',
        image: 'img-late.jpg',
      }

      const result = dedupe([itemLate, itemEarly])
      assert.equal(result.length, 1)
      assert.equal(result[0].endDate, '2026-11-28T16:00:00Z')
    })

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

    it('merges Epic and GamerPower Contractor Part II / Part 2 keeping worth and end date', () => {
      const now = Date.parse('2026-11-25T10:00:00Z')
      const epicItem = {
        id: 'epic-contractor',
        title: 'Contractor: The Clean Up Part II',
        image: 'https://cdn1.epicgames.com/contractor.png',
        slug: 'contractor-part-ii',
        namespace: 'ns-contractor',
        worth: { amount: 179, currency: 'INR', source: 'Epic Games Store' },
      }
      const gpItem = {
        id: 3852,
        title: 'Contractor: The Clean Up Part 2 (Epic Games) Giveaway',
        platforms: 'PC, Epic Games Store',
        thumbnail: 'https://gp.com/contractor.jpg',
        end_date: '2026-12-02 23:59:00',
        open_giveaway_url: 'https://gp.com/open/contractor-2',
      }

      const merged = mergeFreeSources({
        epicItems: [epicItem],
        gamerPowerItems: [gpItem],
        itadFreeItems: [],
        now,
      })

      assert.equal(merged.length, 1)
      assert.equal(merged[0].worthInr, 179)
      assert.equal(merged[0].end_date, '2026-12-02 23:59:00')
    })

    it('fills missing image from duplicate record', () => {
      const noImageOfficial = {
        id: 'epic-no-img',
        title: 'Indie Mystery',
        namespace: 'ns-mystery',
        slug: 'indie-mystery',
        endDate: '2026-12-02T16:00:00.000Z',
      }
      const gpWithImage = {
        id: 5001,
        title: 'Indie Mystery (Epic Games) Giveaway',
        platforms: 'PC, Epic Games Store',
        image: 'https://gp.com/mystery.jpg',
        thumbnail: 'https://gp.com/mystery-thumb.jpg',
        end_date: '2026-12-02 16:00:00',
      }

      const result = dedupe([noImageOfficial, gpWithImage])
      assert.equal(result.length, 1)
      assert.equal(result[0].image, 'https://gp.com/mystery.jpg')
    })

    it('merges titles differing only by punctuation/case like Bread & Fred vs Bread and Fred', () => {
      const a = {
        id: 'epic-bread',
        title: 'Bread & Fred',
        namespace: 'ns-bread',
        image: 'https://cdn.example/bread.jpg',
        endDate: '2026-12-05T16:00:00.000Z',
      }
      const b = {
        id: 9001,
        title: 'bread and fred (Epic Games) Giveaway',
        platforms: 'PC, Epic Games Store',
        thumbnail: 'https://gp.com/bread.jpg',
        end_date: '2026-12-05 16:00:00',
      }

      const result = dedupe([a, b])
      assert.equal(result.length, 1)
    })
  })

  describe('dedupeKey', () => {
    it('matches Part II and Part 2 for Contractor, Rocky, and Hades', () => {
      assert.equal(
        dedupeKey('Contractor: The Clean Up Part II'),
        dedupeKey('Contractor: The Clean Up Part 2')
      )
      assert.equal(dedupeKey('Rocky II'), dedupeKey('Rocky 2'))
      assert.equal(dedupeKey('Hades II'), dedupeKey('Hades 2'))
    })

    it('leaves ambiguous single-letter numerals I, V, X unchanged', () => {
      assert.notEqual(dedupeKey('I Am Alive'), dedupeKey('2 Am Alive'))
      assert.notEqual(dedupeKey('I Am Alive'), dedupeKey('1 Am Alive'))
      assert.notEqual(dedupeKey('V Rising'), dedupeKey('5 Rising'))
      assert.notEqual(dedupeKey('Mega Man X'), dedupeKey('Mega Man 10'))
    })

    it('does not collapse Final Fantasy and Final Fantasy II', () => {
      assert.notEqual(dedupeKey('Final Fantasy'), dedupeKey('Final Fantasy II'))
    })

    it('merges Bread & Fred and Bread and Fred', () => {
      assert.equal(dedupeKey('Bread & Fred'), dedupeKey('Bread and Fred'))
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
