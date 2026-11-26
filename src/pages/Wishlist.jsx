import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import SafeImage from '../components/SafeImage'
import {
  BellIcon,
  TrashIcon,
  ExternalLinkIcon,
  CircleCheckIcon as CheckCircleIcon,
} from '../components/icons'
import {
  titleKey,
  isConsoleGame,
  normalizeFreeTitle,
  evaluateWishlistDeal,
} from '../lib/wishlistAlerts'
import {
  formatDealExpiry,
  formatDealPrice,
  formatStoreName,
  matchDealForGame,
  useDeals,
} from '../lib/dealsData'
import { formatWorthInr, mergeFreeSources } from '../lib/freeGames'

const ITAD_CACHE_KEY = 'wishradar_wishlist_itad_v1'
const ITAD_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ITAD_PRICE_TTL_MS = 30 * 60 * 1000

const POPULAR_STARTER_GAMES = [
  {
    title: 'Cyberpunk 2077',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
    platform: 'PC / Steam',
    genre: 'RPG / Open World',
  },
  {
    title: 'The Witcher 3: Wild Hunt',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg',
    platform: 'PC / Steam',
    genre: 'RPG / Action',
  },
  {
    title: 'Grand Theft Auto V',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg',
    platform: 'PC / Steam',
    genre: 'Action / Adventure',
  },
  {
    title: 'Elden Ring',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg',
    platform: 'PC / Steam',
    genre: 'Action RPG',
  },
]

function formatCountdown(endDate, now) {
  if (!endDate || endDate === 'N/A') return 'Limited Time'
  const cleanDate = endDate.includes('T') ? endDate : endDate.replace(' ', 'T') + 'Z'
  const end = new Date(cleanDate).getTime()
  if (Number.isNaN(end)) return 'Limited Time'
  const diff = end - (now || Date.now())
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

function readLocalItadCache() {
  try {
    const raw = localStorage.getItem(ITAD_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalItadCache(cache) {
  try {
    localStorage.setItem(ITAD_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage quota issues
  }
}



function getConsoleLinks(title, platform = '') {
  const q = encodeURIComponent(title)
  const p = String(platform || '').toLowerCase()
  const links = []
  if (p.includes('playstation') || p.includes('ps')) {
    links.push({ label: 'PS Store', url: `https://store.playstation.com/en-in/search/${q}` })
  }
  if (p.includes('xbox')) {
    links.push({ label: 'Xbox', url: `https://www.xbox.com/en-IN/search?q=${q}` })
  }
  if (p.includes('nintendo') || p.includes('switch')) {
    links.push({ label: 'Nintendo', url: `https://www.nintendo.com/search/#q=${q}` })
  }
  if (links.length === 0) {
    links.push({ label: 'PS Store', url: `https://store.playstation.com/en-in/search/${q}` })
    links.push({ label: 'Xbox', url: `https://www.xbox.com/en-IN/search?q=${q}` })
  }
  return links
}

// ─── Wishlist Card Component ─────────────────────────────────────────────────
function WishlistCard({
  game,
  deal,
  freeGame,
  priceLoading,
  alertSensitivity,
  now,
  onRemove,
  onUpdate,
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const isAlertsOn = game.notify !== false

  const coverImage =
    (!imgFailed && (game.image || deal?.image || freeGame?.image || freeGame?.thumbnail)) || ''
  const isConsole = isConsoleGame(game.platform)

  const isDealFree = Boolean(deal && (Number(deal.cut) >= 100 || Number(deal.price) === 0))
  const isFree = Boolean(!isConsole && (freeGame || isDealFree))
  const isOnSale = Boolean(!isConsole && !isFree && deal && Number(deal.cut) > 0)

  let cardState = 'not_on_sale'
  if (isConsole) cardState = 'console'
  else if (isFree) cardState = 'free'
  else if (isOnSale) cardState = 'sale'

  const historyLow = deal?.historyLow != null ? Number(deal.historyLow) : null
  const goodEval = isOnSale
    ? evaluateWishlistDeal(
        { salePrice: deal.price, savings: deal.cut, lowestPrice: historyLow },
        'good',
        historyLow
      )
    : { fires: false }
  const userEval = isOnSale
    ? evaluateWishlistDeal(
        { salePrice: deal.price, savings: deal.cut, lowestPrice: historyLow },
        alertSensitivity,
        historyLow
      )
    : { fires: false }

  const storeLabel = deal
    ? formatStoreName(deal.store || deal.shop?.name || 'PC Store')
    : isFree
      ? freeGame?.store ||
        (freeGame?.platforms ? freeGame.platforms.replace('PC, ', '') : 'Epic')
      : game.platform || 'PC'

  const claimUrl =
    freeGame?.open_giveaway_url ||
    freeGame?.url ||
    freeGame?.gamerpower_url ||
    deal?.url ||
    null

  const dealUrl = deal?.url || null
  const expiryLabel = deal?.expiry ? formatDealExpiry(deal.expiry, now) : null
  const freeWorthInr = freeGame?.worthInr > 0 ? formatWorthInr(freeGame.worthInr) : ''

  return (
    <article className="wishlist-card-redesign">
      <div className="wishlist-card-media">
        {coverImage ? (
          <img
            src={coverImage}
            alt={game.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="wishlist-card-img"
          />
        ) : (
          <div className="wishlist-card-fallback" aria-hidden="true">
            {game.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="wishlist-card-vignette" aria-hidden="true" />
      </div>

      <div className="wishlist-card-top">
        <div className="wishlist-card-tags">
          {cardState === 'free' && (
            <span className="wishlist-tag wishlist-tag--free">FREE NOW</span>
          )}
          {cardState === 'sale' && (
            <>
              <span className="wishlist-tag wishlist-tag--sale">
                ON SALE -{Math.round(Number(deal.cut))}%
              </span>
              {(goodEval.fires || (userEval.fires && userEval.isNearLow)) && (
                <span className="wishlist-tag wishlist-tag--low">
                  {deal.isLowestEver ? 'ALL-TIME LOW' : 'NEAR ALL-TIME LOW'}
                </span>
              )}
            </>
          )}
          {cardState === 'console' && (
            <span className="wishlist-tag wishlist-tag--console">CONSOLE</span>
          )}
          {cardState === 'not_on_sale' && (
            <span className="wishlist-tag wishlist-tag--neutral">
              {priceLoading ? 'CHECKING PRICE' : 'NO CURRENT DEAL'}
            </span>
          )}
        </div>

        <div className="wishlist-card-actions">
          <button
            type="button"
            className={`wishlist-action-btn ${isAlertsOn ? 'is-active' : ''}`}
            onClick={() => onUpdate(game.title, { notify: !isAlertsOn })}
            aria-label={isAlertsOn ? 'Turn off price alerts' : 'Turn on price alerts'}
            title={isAlertsOn ? 'Price alerts ON' : 'Price alerts OFF'}
          >
            <BellIcon active={isAlertsOn} />
          </button>
          <button
            type="button"
            className="wishlist-action-btn wishlist-action-btn--remove"
            onClick={() => onRemove(game.title)}
            aria-label={`Remove ${game.title} from wishlist`}
            title="Remove from wishlist"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="wishlist-card-bottom-overlay">
        <h2 className="wishlist-card-title" title={game.title}>
          {game.title}
        </h2>

        <div className="wishlist-card-meta">
          <span className="wishlist-store-chip">{storeLabel}</span>
          {expiryLabel && cardState === 'sale' && (
            <span className="wishlist-countdown-chip">{expiryLabel}</span>
          )}
        </div>

        {cardState === 'free' && (
          <div className="wishlist-details-group">
            <div className="wishlist-price-row">
              <span className="wishlist-price-free">Free</span>
              {freeWorthInr && <del className="wishlist-price-old">{freeWorthInr}</del>}
              {(freeGame?.end_date || freeGame?.endDate) && (
                <span className="wishlist-countdown-chip">
                  {formatCountdown(freeGame.end_date || freeGame.endDate, now)}
                </span>
              )}
            </div>
            {claimUrl && (
              <a
                href={claimUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lr-button wishlist-cta-btn wishlist-cta-btn--free"
              >
                Claim now <ExternalLinkIcon />
              </a>
            )}
          </div>
        )}

        {cardState === 'sale' && (
          <div className="wishlist-details-group">
            <div className="wishlist-price-row">
              <strong className="wishlist-price-sale">{formatDealPrice(deal.price)}</strong>
              {Number(deal.regular) > Number(deal.price) && (
                <del className="wishlist-price-old">{formatDealPrice(deal.regular)}</del>
              )}
              {historyLow != null && historyLow > 0 && (
                <span className="wishlist-lowest-chip" title="Historical lowest price in India">
                  Lowest ever {formatDealPrice(historyLow)}
                </span>
              )}
            </div>
            {dealUrl && (
              <a
                href={dealUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lr-button wishlist-cta-btn wishlist-cta-btn--deal"
              >
                View deal <ExternalLinkIcon />
              </a>
            )}
          </div>
        )}

        {cardState === 'not_on_sale' && (
          <div className="wishlist-details-group">
            {priceLoading ? (
              <div className="lr-skeleton" style={{ height: '18px', width: '75%' }} />
            ) : (
              <div className="wishlist-price-row">
                <span className="wishlist-price-regular">
                  No current deal in Steam, Epic or EA Store
                </span>
              </div>
            )}
          </div>
        )}

        {cardState === 'console' && (
          <div className="wishlist-details-group">
            <div className="wishlist-price-row">
              <span className="wishlist-console-badge">Price tracking unavailable</span>
            </div>
            <div className="wishlist-console-links" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {getConsoleLinks(game.title, game.platform).map((lnk) => (
                <a
                  key={lnk.label}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lr-button lr-button--ghost"
                  style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
                >
                  {lnk.label} <ExternalLinkIcon />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

// ─── Main Wishlist Component ─────────────────────────────────────────────────
export default function Wishlist({
  games = [],
  setGames,
  ownedGames = [],
  freeGames = [],
  session,
  onNavigate,
}) {
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [epicCurrent, setEpicCurrent] = useState([])
  const [gpFree, setGpFree] = useState([])
  const [livePrices, setLivePrices] = useState(() => readLocalItadCache())
  const [pricesLoading, setPricesLoading] = useState(false)
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  const [now, setNow] = useState(Date.now())

  const { deals: itadDeals, free: itadFree } = useDeals()

  const [sortBy, setSortBy] = useState('best')
  const [alertSensitivity, setAlertSensitivity] = useState(() => {
    try {
      return localStorage.getItem('wishradar_alert_sensitivity') || 'good'
    } catch {
      return 'good'
    }
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Load free game snapshots for free-giveaway priority
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      fetch('/data/epic-free-games.json'),
      fetch('/data/gamerpower-free-games.json'),
    ]).then(async ([epicRes, gpRes]) => {
      if (cancelled) return
      if (epicRes.status === 'fulfilled' && epicRes.value.ok) {
        const data = await epicRes.value.json().catch(() => null)
        if (!cancelled && Array.isArray(data?.current)) setEpicCurrent(data.current)
      }
      if (gpRes.status === 'fulfilled' && gpRes.value.ok) {
        const data = await gpRes.value.json().catch(() => null)
        if (!cancelled && Array.isArray(data?.games)) setGpFree(data.games)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Telegram status & user notification settings from Supabase
  useEffect(() => {
    if (!session || !supabase) {
      setTelegramConnected(false)
      return undefined
    }
    let cancelled = false

    supabase
      .from('telegram_connections')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTelegramConnected(Boolean(data))
      })
      .catch(() => {
        if (!cancelled) setTelegramConnected(false)
      })

    supabase
      .from('notification_settings')
      .select('alert_sensitivity')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.alert_sensitivity) {
          setAlertSensitivity(data.alert_sensitivity)
          try {
            localStorage.setItem('wishradar_alert_sensitivity', data.alert_sensitivity)
          } catch {}
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [session])

  function handleSensitivityChange(nextSensitivity) {
    setAlertSensitivity(nextSensitivity)
    try {
      localStorage.setItem('wishradar_alert_sensitivity', nextSensitivity)
    } catch {}

    if (session && supabase) {
      supabase
        .from('notification_settings')
        .upsert(
          {
            user_id: session.user.id,
            alert_sensitivity: nextSensitivity,
          },
          { onConflict: 'user_id' }
        )
        .catch((err) => {
          console.error('Could not save alert sensitivity:', err.message)
        })
    }
  }

  const combinedFreeGames = useMemo(() => {
    return mergeFreeSources({
      epicItems: epicCurrent,
      gamerPowerItems: [...(Array.isArray(freeGames) ? freeGames : []), ...gpFree],
      itadFreeItems: itadFree,
      now,
    })
  }, [epicCurrent, freeGames, gpFree, itadFree, now])

  const freeByTitle = useMemo(() => {
    const match = new Map()
    combinedFreeGames.forEach((game) => {
      const keyFull = titleKey(game.title)
      const keyClean = titleKey(normalizeFreeTitle(game.title))
      if (!match.has(keyFull)) match.set(keyFull, game)
      if (keyClean && !match.has(keyClean)) match.set(keyClean, game)
    })
    return match
  }, [combinedFreeGames])

  function findFreeGame(title) {
    if (!title) return null
    const key = titleKey(title)
    if (freeByTitle.has(key)) return freeByTitle.get(key)
    const cleanKey = titleKey(normalizeFreeTitle(title))
    if (freeByTitle.has(cleanKey)) return freeByTitle.get(cleanKey)
    return null
  }

  // Lazy batched ITAD lookup via serverless /api/itad-prices
  useEffect(() => {
    let cancelled = false
    const nowMs = Date.now()
    const pcGames = games.filter((g) => g?.title && !isConsoleGame(g.platform))
    if (pcGames.length === 0) return undefined

    const cache = readLocalItadCache()
    const needed = []
    for (const g of pcGames) {
      const key = titleKey(g.title)
      const entry = cache[key]
      const idFresh = entry?.itadId && nowMs - (entry.resolvedAt || 0) < ITAD_ID_TTL_MS
      const priceFresh = entry && nowMs - (entry.pricedAt || 0) < ITAD_PRICE_TTL_MS
      if (!priceFresh) {
        needed.push({
          key,
          title: g.title,
          itadId: idFresh ? entry.itadId : null,
        })
      }
    }

    if (needed.length === 0) return undefined

    async function fetchBatch() {
      setPricesLoading(true)
      try {
        const chunk = needed.slice(0, 25)
        const ids = chunk.filter((x) => x.itadId).map((x) => x.itadId)
        const titles = chunk.filter((x) => !x.itadId).map((x) => x.title)

        const res = await fetch('/api/itad-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, titles }),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        const returned = data?.prices || {}
        const updatedCache = { ...readLocalItadCache() }
        const stamp = Date.now()

        for (const item of chunk) {
          const payload = returned[item.itadId || item.title]
          if (payload !== undefined) {
            updatedCache[item.key] = {
              itadId: payload.itadId || item.itadId || null,
              deal: payload.deal || null,
              resolvedAt: payload.itadId ? stamp : updatedCache[item.key]?.resolvedAt || stamp,
              pricedAt: stamp,
            }
          }
        }

        if (!cancelled) {
          writeLocalItadCache(updatedCache)
          setLivePrices(updatedCache)
          setLiveUnavailable(false)
        }
      } catch {
        if (!cancelled) {
          setLiveUnavailable(true)
        }
      } finally {
        if (!cancelled) setPricesLoading(false)
      }
    }

    fetchBatch()
    return () => {
      cancelled = true
    }
  }, [games])

  function getDealForGame(game) {
    if (!game?.title || isConsoleGame(game.platform)) return null
    const key = titleKey(game.title)
    const cached = livePrices[key]
    if (cached?.deal) return cached.deal

    // Fallback to global itad-deals.json snapshot if live function unavailable or not cached
    const snapMatch = matchDealForGame(game, itadDeals)
    if (snapMatch) {
      return {
        itadId: snapMatch.itadId,
        store: snapMatch.shop?.name || '',
        storeId: snapMatch.shop?.id ?? null,
        price: snapMatch.price,
        regular: snapMatch.regular,
        cut: snapMatch.cut,
        currency: 'INR',
        expiry: snapMatch.expiry,
        url: snapMatch.url,
        historyLow: snapMatch.historyLow,
        isLowestEver: snapMatch.isLowestEver,
      }
    }
    return null
  }

  const saleOrFreeCount = useMemo(() => {
    return games.filter((g) => {
      if (isConsoleGame(g.platform)) return false
      const free = findFreeGame(g.title)
      const deal = getDealForGame(g)
      const isDealFree = Boolean(deal && (Number(deal.cut) >= 100 || Number(deal.price) === 0))
      const isFree = Boolean(free || isDealFree)
      const isOnSale = Boolean(!isFree && deal && Number(deal.cut) > 0)
      return isFree || isOnSale
    }).length
  }, [games, freeByTitle, livePrices, itadDeals])

  const sortedGames = useMemo(() => {
    const list = [...games]
    if (sortBy === 'recent') {
      return list.sort((a, b) => {
        const aTime = a?.addedAt ? (typeof a.addedAt === 'number' ? a.addedAt : new Date(a.addedAt).getTime()) : -1
        const bTime = b?.addedAt ? (typeof b.addedAt === 'number' ? b.addedAt : new Date(b.addedAt).getTime()) : -1
        const validA = Number.isFinite(aTime) ? aTime : -1
        const validB = Number.isFinite(bTime) ? bTime : -1
        if (validA === -1 && validB === -1) return 0
        if (validA === -1) return 1
        if (validB === -1) return -1
        return validB - validA
      })
    }
    if (sortBy === 'alpha') return list.sort((a, b) => a.title.localeCompare(b.title))

    return list.sort((a, b) => {
      const freeA = findFreeGame(a.title) ? 1 : 0
      const freeB = findFreeGame(b.title) ? 1 : 0
      if (freeA !== freeB) return freeB - freeA

      const dealA = getDealForGame(a)
      const dealB = getDealForGame(b)
      const cutA = dealA ? Number(dealA.cut || 0) : -1
      const cutB = dealB ? Number(dealB.cut || 0) : -1
      if (cutA !== cutB) return cutB - cutA

      const priceA = dealA ? Number(dealA.price ?? 999999) : 999999
      const priceB = dealB ? Number(dealB.price ?? 999999) : 999999
      return priceA - priceB
    })
  }, [games, sortBy, freeByTitle, livePrices, itadDeals])

  function addGame(gameToAdd) {
    if (!gameToAdd || !gameToAdd.title) return
    const key = titleKey(gameToAdd.title)
    setGames((current) => {
      const list = Array.isArray(current) ? current : []
      if (list.some((g) => titleKey(g.title) === key)) return list
      return [...list, { ...gameToAdd, notify: true, addedAt: gameToAdd.addedAt || Date.now() }]
    })
  }

  function updateGame(title, updates) {
    setGames((current) =>
      current.map((game) =>
        titleKey(game.title) === titleKey(title) ? { ...game, ...updates } : game
      )
    )
  }

  function removeGame(titleToRemove) {
    setGames((current) =>
      current.filter((game) => titleKey(game.title) !== titleKey(titleToRemove))
    )
  }

  return (
    <div className="wishlist-page-redesign">
      <header className="wishlist-header">
        <div className="wishlist-header__main">
          <h1>Wishlist</h1>
          <div className="wishlist-tabs" role="tablist" aria-label="Collections tabs">
            <button
              type="button"
              id="wishlist-tab"
              role="tab"
              aria-selected="true"
              aria-controls="wishlist-tabpanel"
              className="wishlist-tab is-active"
            >
              Wishlist <span className="wishlist-tab__count">{games.length}</span>
            </button>
            <button
              type="button"
              id="library-tab"
              role="tab"
              aria-selected="false"
              aria-controls="wishlist-tabpanel"
              className="wishlist-tab"
              onClick={() => onNavigate('library')}
            >
              Owned <span className="wishlist-tab__count">{ownedGames.length}</span>
            </button>
          </div>
        </div>

        <div className="wishlist-controls">
          <label className="wishlist-control-label">
            <span className="wishlist-control-title">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="wishlist-select"
              aria-label="Sort wishlist"
            >
              <option value="best">Best deals first</option>
              <option value="recent">Recently added</option>
              <option value="alpha">A-Z</option>
            </select>
          </label>

          <label className="wishlist-control-label">
            <span className="wishlist-control-title">Alert sensitivity</span>
            <select
              value={alertSensitivity}
              onChange={(e) => handleSensitivityChange(e.target.value)}
              className="wishlist-select"
              aria-label="Alert sensitivity"
            >
              <option value="any">Any sale (25%+)</option>
              <option value="good">Good deals (default)</option>
              <option value="great">Only great deals (50%+ or all-time low)</option>
            </select>
          </label>
        </div>
      </header>

      <section className="wishlist-banner" aria-label="Wishlist status summary">
        <div className="wishlist-banner__info">
          <span className="wishlist-banner__indicator" aria-hidden="true" />
          <p>
            <strong>{saleOrFreeCount} of your games</strong> are on sale or free right now
            {liveUnavailable && (
              <span className="wishlist-live-note" style={{ marginLeft: '8px', color: 'var(--muted)', fontSize: '12px' }}>
                · Live price unavailable
              </span>
            )}
          </p>
        </div>
        <div className="wishlist-banner__telegram" aria-live="polite">
          {telegramConnected ? (
            <span className="wishlist-telegram-badge">
              <CheckCircleIcon /> Telegram connected
            </span>
          ) : (
            <button
              type="button"
              className="wishlist-telegram-btn"
              onClick={() => onNavigate('account')}
            >
              Connect Telegram
            </button>
          )}
        </div>
      </section>

      <div id="wishlist-tabpanel" role="tabpanel" aria-labelledby="wishlist-tab">
        {games.length === 0 ? (
          <div className="wishlist-empty-redesign">
            <div className="lr-art-fallback" aria-hidden="true">★</div>
            <h2>Your Wishlist is waiting for its next great game.</h2>
            <p>Track price drops, giveaways, and sale alerts across your favorite titles.</p>
            <div className="wishlist-empty-actions">
              <button type="button" className="lr-button" onClick={() => onNavigate('deals')}>
                Browse Deals
              </button>
              <button
                type="button"
                className="lr-button lr-button--ghost"
                onClick={() => onNavigate('free')}
              >
                See Free Now
              </button>
            </div>

            <div className="empty-suggestions-shelf">
              <div className="empty-suggestions-header">
                <span className="empty-suggestions-kicker">QUICK START</span>
                <h3 className="empty-suggestions-title">Trending Games to Track</h3>
              </div>
              <div className="empty-suggestions-grid">
                {POPULAR_STARTER_GAMES.map((item) => {
                  const isSaved = games.some((g) => titleKey(g.title) === titleKey(item.title))
                  return (
                    <article key={item.title} className="empty-suggestion-card">
                      <div className="empty-suggestion-card__media">
                        <SafeImage src={item.image} alt={item.title} fallbackText={item.title} />
                      </div>
                      <div className="empty-suggestion-card__body">
                        <h4 className="empty-suggestion-card__title" title={item.title}>
                          {item.title}
                        </h4>
                        <span className="empty-suggestion-card__meta">{item.genre}</span>
                        <button
                          type="button"
                          className={`empty-suggestion-card__btn ${isSaved ? 'is-added' : ''}`}
                          onClick={() => !isSaved && addGame(item)}
                          disabled={isSaved}
                          aria-label={`Add ${item.title} to wishlist`}
                        >
                          {isSaved ? '✓ Added' : '+ Add to Wishlist'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="wishlist-grid-redesign">
            {sortedGames.map((game, index) => {
              const key = titleKey(game.title)
              const deal = getDealForGame(game)
              const freeGame = findFreeGame(game.title)
              return (
                <WishlistCard
                  key={`${key}-${index}`}
                  game={game}
                  deal={deal}
                  freeGame={freeGame}
                  priceLoading={pricesLoading && !deal && !freeGame}
                  alertSensitivity={alertSensitivity}
                  now={now}
                  onRemove={removeGame}
                  onUpdate={updateGame}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
