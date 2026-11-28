import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSentAlertKeySet,
  buildWindowsFromSnapshots,
  computeHoursLeft,
  createRateLimiter,
  formatFreeGameMessage,
  formatWishlistDealMessage,
  hasAlreadySentAlert,
  istLabel,
  resolveWindowStart,
  sendWithRetries,
  shouldSkipMidWindowForRecentLateDayBefore,
} from '../../../scripts/lib/telegramAlertHelpers.mjs'

describe('telegramAlertHelpers', () => {
  it('merges Epic and GamerPower windows with the same dedupeKey and keeps Epic start/end', () => {
    const epic = {
      current: [
        {
          id: 'epic-1',
          title: 'Bread and Fred',
          slug: 'bread-and-fred',
          startDate: '2026-11-26T16:00:00.000Z',
          endDate: '2026-12-03T16:00:00.000Z',
          image: '',
        },
        {
          id: 'epic-2',
          title: 'Contractor: The Clean Up Part II',
          slug: 'contractor-2',
          startDate: '2026-11-26T16:00:00.000Z',
          endDate: '2026-12-03T16:00:00.000Z',
          image: 'https://cdn.example/c2.jpg',
        },
      ],
      upcoming: [],
    }
    const gamerPower = {
      games: [
        {
          id: 9001,
          title: 'Bread and Fred (Epic Games) Giveaway',
          type: 'Game',
          platforms: 'PC, Epic Games Store',
          end_date: '2026-12-03 23:59:00',
          open_giveaway_url: 'https://www.gamerpower.com/open/bread-and-fred',
          thumbnail: 'https://www.gamerpower.com/offers/1/bf.jpg',
        },
        {
          id: 9002,
          title: 'Contractor: The Clean Up Part 2 (Epic Games) Giveaway',
          type: 'Game',
          platforms: 'PC, Epic Games Store',
          end_date: '2026-12-03 23:59:00',
          open_giveaway_url: 'https://www.gamerpower.com/open/contractor-2',
        },
      ],
    }

    const windows = buildWindowsFromSnapshots({ epic, gamerPower })
    assert.equal(windows.length, 2)

    const bread = windows.find((w) => w.title === 'Bread and Fred')
    assert.ok(bread)
    assert.equal(bread.source, 'Epic Games Store')
    assert.equal(bread.start_at, '2026-11-26T16:00:00.000Z')
    assert.equal(bread.end_at, '2026-12-03T16:00:00.000Z')
    assert.equal(bread.image, 'https://www.gamerpower.com/offers/1/bf.jpg')
    assert.equal(bread.game_key, 'title:bread and fred')
    assert.equal(bread.legacy_keys.length, 2)
  })

  it('excludes mobile, DLC, Loot, and cleans store/giveaway suffixes from titles', () => {
    const gamerPower = {
      games: [
        {
          id: 1,
          title: 'A Tiny Sticker Tale (Mobile) Giveaway',
          type: 'Game',
          platforms: 'Android, iOS',
          end_date: '2026-12-03 23:59:00',
        },
        {
          id: 2,
          title: 'Firestone: Free $100 Welcome Gift',
          type: 'DLC',
          platforms: 'PC, Steam',
          end_date: '2026-12-03 23:59:00',
        },
        {
          id: 3,
          title: 'World of Warships: Black Friday Giveaway',
          type: 'Loot',
          platforms: 'PC',
          end_date: '2026-12-04 23:59:00',
        },
        {
          id: 4,
          title: 'Last Room (IndieGala) Giveaway',
          type: 'Game',
          platforms: 'PC, DRM-Free',
          end_date: '2026-12-04 23:59:00',
          open_giveaway_url: 'https://www.gamerpower.com/open/last-room',
        },
      ],
    }

    const windows = buildWindowsFromSnapshots({ epic: {}, gamerPower })
    assert.equal(windows.length, 1)
    assert.equal(windows[0].title, 'Last Room')
  })

  it('treats legacy source-based sent_alerts keys as already sent', () => {
    const window = {
      game_key: 'title:bread and fred',
      legacy_keys: ['epic:epic-1:2026-11-26T16:00:00.000Z:2026-12-03T16:00:00.000Z'],
    }
    const sentKeys = new Set([
      'user-1|epic:epic-1:2026-11-26T16:00:00.000Z:2026-12-03T16:00:00.000Z|2026-11-26T16:00:00.000Z|mid_window',
    ])

    assert.equal(
      hasAlreadySentAlert({
        sentKeys,
        userId: 'user-1',
        window,
        windowStart: '2026-11-26T16:00:00.000Z',
        alertKind: 'mid_window',
      }),
      true
    )
    assert.equal(
      hasAlreadySentAlert({
        sentKeys,
        userId: 'user-1',
        window,
        windowStart: '2026-11-26T16:00:00.000Z',
        alertKind: 'ending_soon',
      }),
      false
    )
  })

  it('renders the three free-game templates with inline buttons and no raw URL in text', () => {
    const window = {
      title: 'Hollow Knight',
      platform: 'Epic',
      start_at: '2026-12-03T16:00:00.000Z',
      end_at: '2026-12-10T16:00:00.000Z',
      link: 'https://store.epicgames.com/en-US/p/hollow-knight',
    }
    const beforeStart = new Date('2026-12-02T17:00:00.000Z')
    const duringWindow = new Date('2026-12-10T10:20:00.000Z') // 5h40m -> ceil = 6

    const dayBefore = formatFreeGameMessage({ kind: 'day_before', window, now: beforeStart })
    assert.equal(
      dayBefore.text,
      `🎁 Free tomorrow: Hollow Knight\nStarts: ${istLabel(window.start_at)}\nStore: Epic`
    )
    assert.equal(dayBefore.buttonLabel, 'Open store page')
    assert.equal(dayBefore.replyMarkup.inline_keyboard[0][0].url, window.link)

    const midWindow = formatFreeGameMessage({ kind: 'mid_window', window, now: duringWindow })
    assert.equal(
      midWindow.text,
      `🎮 Free right now: Hollow Knight\nEnds: ${istLabel(window.end_at)}\nStore: Epic`
    )
    assert.equal(midWindow.buttonLabel, 'Claim now')

    const endingSoon = formatFreeGameMessage({ kind: 'ending_soon', window, now: duringWindow })
    assert.equal(
      endingSoon.text,
      `⏰ Ends in about 6 hours: Hollow Knight\nEnds: ${istLabel(window.end_at)}\nStore: Epic`
    )
    assert.equal(endingSoon.buttonLabel, 'Claim now')

    const noLink = formatFreeGameMessage({ kind: 'mid_window', window: { ...window, link: '' }, now: duringWindow })
    assert.equal(noLink.replyMarkup, undefined)
    assert.equal(noLink.buttonLabel, null)
  })

  it('renders late day_before (now >= start_at) as Free right now and skips mid_window within 12h', () => {
    const window = {
      game_key: 'title:bread and fred',
      title: 'Bread and Fred',
      platform: 'Epic',
      start_at: '2026-11-26T16:00:00.000Z',
      end_at: '2026-12-03T16:00:00.000Z',
      link: 'https://store.epicgames.com/en-US/p/bread-and-fred',
      legacy_keys: [],
    }
    const afterStart = new Date('2026-11-28T04:24:00.000Z')

    const lateMsg = formatFreeGameMessage({ kind: 'day_before', window, now: afterStart })
    assert.equal(
      lateMsg.text,
      `🎮 Free right now: Bread and Fred\nEnds: ${istLabel(window.end_at)}\nStore: Epic`
    )
    assert.ok(!lateMsg.text.includes('Starts:'))
    assert.equal(lateMsg.buttonLabel, 'Claim now')

    const sentAlerts = [
      {
        user_id: 'u1',
        game_key: 'title:bread and fred',
        window_start: '2026-11-26T16:00:00.000Z',
        alert_kind: 'day_before',
        sent_at: '2026-11-28T04:24:00.000Z',
      },
    ]
    assert.equal(
      shouldSkipMidWindowForRecentLateDayBefore({
        sentAlerts,
        userId: 'u1',
        window,
        windowStart: resolveWindowStart(window),
        now: new Date('2026-11-28T10:00:00.000Z'), // ~5.6h later
      }),
      true
    )
    assert.equal(
      shouldSkipMidWindowForRecentLateDayBefore({
        sentAlerts,
        userId: 'u1',
        window,
        windowStart: resolveWindowStart(window),
        now: new Date('2026-11-29T10:00:00.000Z'), // > 12h later
      }),
      false
    )
  })

  it('allows same title in a different window and dedupes null-start_at windows stably', () => {
    const win1 = {
      game_key: 'title:hollow knight',
      start_at: '2026-11-01T16:00:00.000Z',
      end_at: '2026-11-08T16:00:00.000Z',
      legacy_keys: [],
    }
    const win2 = {
      game_key: 'title:hollow knight',
      start_at: '2026-12-20T16:00:00.000Z',
      end_at: '2026-12-27T16:00:00.000Z',
      legacy_keys: [],
    }
    const gpNoStart = {
      game_key: 'title:dead age 2',
      start_at: null,
      end_at: '2026-11-30T23:59:00.000Z',
      legacy_keys: ['gamerpower:3800:2026-11-30T23:59:00.000Z'],
    }

    const sentKeys = buildSentAlertKeySet([
      {
        user_id: 'u1',
        game_key: 'title:hollow knight',
        window_start: '2026-11-01T16:00:00+00:00',
        alert_kind: 'day_before',
      },
      {
        user_id: 'u1',
        game_key: 'gamerpower:3800:2026-11-30T23:59:00.000Z',
        window_start: '2026-11-30T23:59:00+00:00',
        alert_kind: 'ending_soon',
      },
    ])

    // Same window & kind -> blocked
    assert.equal(
      hasAlreadySentAlert({
        sentKeys,
        userId: 'u1',
        window: win1,
        windowStart: resolveWindowStart(win1),
        alertKind: 'day_before',
      }),
      true
    )
    // Different window for same title -> NOT blocked
    assert.equal(
      hasAlreadySentAlert({
        sentKeys,
        userId: 'u1',
        window: win2,
        windowStart: resolveWindowStart(win2),
        alertKind: 'day_before',
      }),
      false
    )
    // Window without start_at -> stable non-null windowStart & matches legacy key across runs
    const gpStart = resolveWindowStart(gpNoStart)
    assert.equal(gpStart, '2026-11-30T23:59:00.000Z')
    assert.equal(
      hasAlreadySentAlert({
        sentKeys,
        userId: 'u1',
        window: gpNoStart,
        windowStart: gpStart,
        alertKind: 'ending_soon',
      }),
      true
    )
  })

  it('formats wishlist deal message with View deal button and no raw URL in text', () => {
    const msg = formatWishlistDealMessage({
      title: 'Hades II',
      deal: {
        store: 'Steam',
        price: 650,
        regular: 1300,
        historyLow: 650,
        expiry: '2026-12-04T18:00:00.000Z',
        url: 'https://store.steampowered.com/app/1145350/Hades_II/',
      },
      discountPercent: 50,
      formatInr: (v) => `₹${v}`,
    })
    assert.ok(!msg.text.includes('https://'))
    assert.equal(msg.buttonLabel, 'View deal')
    assert.equal(msg.urlHost, 'store.steampowered.com')
    assert.equal(msg.replyMarkup.inline_keyboard[0][0].text, 'View deal')
  })

  it('computes hoursLeft with Math.ceil and minimum 1', () => {
    const end = new Date('2026-12-03T16:00:00.000Z')
    assert.equal(computeHoursLeft(end, new Date('2026-12-03T15:50:00.000Z')), 1)
    assert.equal(computeHoursLeft(end, new Date('2026-12-03T10:15:00.000Z')), 6)
  })

  it('enforces >= 1100ms per-chat spacing in rate limiter', async () => {
    let clock = 10000
    const sleeps = []
    const limiter = createRateLimiter({
      perChatMs: 1100,
      minGlobalGapMs: 50,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
    })

    await limiter.wait('chat-1')
    clock += 200 // only 200ms elapsed since last send to chat-1
    await limiter.wait('chat-1')
    assert.deepEqual(sleeps, [900])
  })

  it('retries 429 using retryAfter and succeeds on 2nd attempt', async () => {
    const sleeps = []
    let calls = 0
    const res = await sendWithRetries({
      chatId: 'chat-1',
      payload: { text: 'hi' },
      sleep: async (ms) => sleeps.push(ms),
      sendFn: async () => {
        calls++
        if (calls === 1) return { status: 429, ok: false, retryAfter: 4 }
        return { status: 200, ok: true }
      },
    })

    assert.equal(res.ok, true)
    assert.equal(res.retried, true)
    assert.equal(res.givenUp, false)
    assert.deepEqual(sleeps, [5000])
  })

  it('gives up after 3 failed 429 attempts without throwing', async () => {
    const sleeps = []
    let calls = 0
    const res = await sendWithRetries({
      chatId: 'chat-1',
      payload: { text: 'hi' },
      sleep: async (ms) => sleeps.push(ms),
      sendFn: async () => {
        calls++
        return { status: 429, ok: false, retryAfter: 1 }
      },
    })

    assert.equal(calls, 3)
    assert.equal(res.ok, false)
    assert.equal(res.givenUp, true)
    assert.deepEqual(sleeps, [2000, 2000])
  })

  it('calls on403 on HTTP 403 without retrying', async () => {
    let blockedChat = null
    let calls = 0
    const res = await sendWithRetries({
      chatId: 'chat-403',
      payload: { text: 'hi' },
      sleep: async () => {},
      on403: async (id) => {
        blockedChat = id
      },
      sendFn: async () => {
        calls++
        return { status: 403, ok: false }
      },
    })

    assert.equal(calls, 1)
    assert.equal(res.ok, false)
    assert.equal(res.status, 403)
    assert.equal(blockedChat, 'chat-403')
  })
})
