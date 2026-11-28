import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveGameOffer } from '../gameOffer.js'

describe('resolveGameOffer pure price resolution', () => {
  test('returns console fallback for console games with RAWG store URL', () => {
    const consoleGame = {
      name: 'Grand Theft Auto VI',
      platform: 'PlayStation 5',
      platforms: [{ platform: { name: 'PlayStation 5', slug: 'playstation5' } }],
    }
    const offer = resolveGameOffer(consoleGame, {
      deals: [{ title: 'Grand Theft Auto VI', price: 4999, cut: 10 }],
      rawgStores: [
        { storeId: 3, name: 'PlayStation Store', url: 'https://store.playstation.com/gtavi', key: 'id:3' },
      ],
    })
    assert.equal(offer.type, 'console')
    assert.equal(offer.isConsole, true)
    assert.equal(offer.message, 'Price not tracked for consoles')
    assert.equal(offer.canFetchLive, false)
    assert.equal(offer.ctaUrl, 'https://store.playstation.com/gtavi')
    assert.equal(offer.ctaText, 'View on PlayStation Store')
  })

  test('prioritizes currently free giveaways (Branch 1)', () => {
    const game = { name: 'Firestone – Idle Clicker Online RPG' }
    const currentFreeGames = [
      {
        title: 'Firestone – Idle Clicker Online RPG',
        regular: 899,
        endDate: '2026-12-03T16:00:00.000Z',
        slug: 'firestone-slug',
      },
    ]
    const deals = [
      { title: 'Firestone – Idle Clicker Online RPG', price: 450, cut: 50 },
    ]

    const offer = resolveGameOffer(game, { currentFreeGames, deals })
    assert.equal(offer.type, 'free_now')
    assert.equal(offer.badge, 'FREE NOW')
    assert.equal(offer.price, 0)
    assert.equal(offer.formattedPrice, 'Free')
    assert.equal(offer.ctaText, 'Claim free')
    assert.equal(offer.isLowestEver, true)
    assert.ok(offer.ctaUrl.includes('firestone-slug'))
  })

  test('resolves always-free games when not in giveaway (Branch 2)', () => {
    const game = { name: 'Overwatch' }
    const alwaysFreeGames = [
      {
        title: 'Overwatch',
        publisher: 'Blizzard Entertainment',
        gameUrl: 'https://overwatch.com',
      },
    ]

    const offer = resolveGameOffer(game, { alwaysFreeGames })
    assert.equal(offer.type, 'always_free')
    assert.equal(offer.badge, 'ALWAYS FREE')
    assert.equal(offer.price, 0)
    assert.equal(offer.formattedPrice, 'Free')
    assert.equal(offer.ctaText, 'Play free')
    assert.equal(offer.ctaUrl, 'https://overwatch.com')
  })

  test('resolves existing deals snapshot with edition-safe match (Branch 3)', () => {
    const game = { name: 'Cyberpunk 2077' }
    const deals = [
      {
        title: 'Cyberpunk 2077',
        price: 1499,
        regular: 2999,
        cut: 50,
        shop: { name: 'Steam' },
        url: 'https://store.steampowered.com/app/1091500',
        isLowestEver: true,
      },
    ]

    const offer = resolveGameOffer(game, { deals })
    assert.equal(offer.type, 'deal')
    assert.equal(offer.price, 1499)
    assert.equal(offer.formattedPrice, '₹1,499')
    assert.equal(offer.regular, 2999)
    assert.equal(offer.discount, 50)
    assert.equal(offer.badge, '-50%')
    assert.equal(offer.store, 'Steam')
    assert.equal(offer.isLowestEver, true)
    assert.equal(offer.ctaText, 'Get deal')
  })

  test('resolves live ITAD price with cut > 0 as deal (Branch 4)', () => {
    const game = { name: 'The Witcher 3: Wild Hunt' }
    const livePrice = {
      status: 'found',
      deal: {
        price: 399,
        regular: 1599,
        cut: 75,
        shop: 'GOG',
        url: 'https://gog.com/witcher3',
        isLowestEver: false,
      },
    }

    const offer = resolveGameOffer(game, { deals: [], livePrice })
    assert.equal(offer.type, 'deal')
    assert.equal(offer.price, 399)
    assert.equal(offer.formattedPrice, '₹399')
    assert.equal(offer.discount, 75)
    assert.equal(offer.badge, '-75%')
    assert.equal(offer.store, 'GOG')
    assert.equal(offer.ctaText, 'Get deal')
    assert.equal(offer.ctaUrl, 'https://gog.com/witcher3')
  })

  test('resolves live ITAD price with cut === 0 as price without discount badge', () => {
    const game = { name: 'Portal 2' }
    const livePrice = {
      status: 'found',
      deal: {
        price: 509,
        regular: 509,
        cut: 0,
        shop: 'Steam',
        url: 'https://store.steampowered.com/app/620/',
        isLowestEver: false,
      },
    }

    const offer = resolveGameOffer(game, { deals: [], livePrice })
    assert.equal(offer.type, 'price')
    assert.equal(offer.price, 509)
    assert.equal(offer.formattedPrice, '₹509')
    assert.equal(offer.discount, 0)
    assert.equal(offer.badge, null)
    assert.equal(offer.store, 'Steam')
    assert.equal(offer.ctaText, 'Get deal')
  })

  test('resolves no_deal when ITAD checked and returned zero prices, with RAWG fallback CTA', () => {
    const game = { name: 'Grand Theft Auto V' }
    const offer = resolveGameOffer(game, {
      deals: [],
      livePrice: { status: 'no_deal', deal: null, itadId: 'itad-gtav' },
      rawgStores: [
        { storeId: 11, name: 'Epic Games', url: 'https://www.epicgames.com/store/gtav', key: 'id:11' },
        { storeId: 1, name: 'Steam', url: 'https://store.steampowered.com/app/3240220/', key: 'id:1' },
      ],
    })

    assert.equal(offer.type, 'no_deal')
    assert.equal(offer.message, 'No current price from tracked stores')
    assert.equal(offer.ctaUrl, 'https://store.steampowered.com/app/3240220/')
    assert.equal(offer.ctaText, 'View on Steam')
  })

  test('handles fetch errors with RAWG store fallback URL (Branch 5 - error)', () => {
    const game = { name: 'Unknown Indie Game' }
    const offer = resolveGameOffer(game, {
      deals: [],
      fetchError: 'Failed to fetch price (500)',
      rawgStores: [
        { storeId: 5, name: 'GOG', url: 'https://www.gog.com/game/indie', key: 'id:5' },
      ],
    })

    assert.equal(offer.type, 'error')
    assert.equal(offer.message, "Couldn't load price")
    assert.equal(offer.canRetry, true)
    assert.equal(offer.ctaUrl, 'https://www.gog.com/game/indie')
    assert.equal(offer.ctaText, 'View on GOG')
  })

  test('returns null ctaUrl when no offer URL and no RAWG store URLs exist', () => {
    const game = { name: 'Brand New Game with No Store URLs' }
    const offer = resolveGameOffer(game, {
      deals: [],
      livePrice: { status: 'no_deal', deal: null, itadId: null },
      rawgStores: [],
    })

    assert.equal(offer.type, 'no_deal')
    assert.equal(offer.ctaUrl, null)
    assert.equal(offer.ctaText, null)
  })
})
