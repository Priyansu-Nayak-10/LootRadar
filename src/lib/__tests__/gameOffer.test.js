import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveGameOffer } from '../gameOffer.js'

describe('resolveGameOffer pure price resolution', () => {
  test('returns console fallback for console games without looking up prices', () => {
    const consoleGame = {
      name: 'Spider-Man 2',
      platform: 'PlayStation 5',
      platforms: [{ platform: { name: 'PlayStation 5', slug: 'playstation5' } }],
    }
    const offer = resolveGameOffer(consoleGame, {
      deals: [{ title: 'Spider-Man 2', price: 1999, cut: 50 }],
    })
    assert.equal(offer.type, 'console')
    assert.equal(offer.isConsole, true)
    assert.equal(offer.message, 'Price not tracked for this platform')
    assert.equal(offer.canFetchLive, false)
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

  test('resolves live ITAD price fallback when not in snapshot (Branch 4)', () => {
    const game = { name: 'The Witcher 3: Wild Hunt' }
    const livePrice = {
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
  })

  test('handles fetch errors gracefully (Branch 5 - error)', () => {
    const game = { name: 'Unknown Indie Game' }
    const offer = resolveGameOffer(game, {
      deals: [],
      fetchError: 'Failed to fetch price (500)',
    })

    assert.equal(offer.type, 'error')
    assert.equal(offer.message, 'Price unavailable right now')
    assert.equal(offer.canRetry, true)
  })

  test('handles untracked/no deal found cleanly (Branch 5 - untracked)', () => {
    const game = { name: 'Brand New Game with No PC Deal' }
    const offer = resolveGameOffer(game, {
      deals: [],
    })

    assert.equal(offer.type, 'untracked')
    assert.equal(offer.message, 'No current deal found for PC')
    assert.equal(offer.canFetchLive, true)
  })
})
