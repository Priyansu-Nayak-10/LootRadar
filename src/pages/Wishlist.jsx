import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  titleKey,
  formatUsd,
  isConsoleGame,
  normalizeFreeTitle,
  evaluateWishlistDeal,
} from '../lib/wishlistAlerts'
import { STORE_NAMES, formatStoreName } from '../lib/dealsData'

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

// ─── Inline SVG Icons ────────────────────────────────────────────────────────
function BellIcon({ active }) {
  if (active) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        className="wishlist-icon wishlist-icon--active"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 20h4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="wishlist-icon wishlist-icon--muted"
      aria-hidden="true"
    >
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="wishlist-icon"
      aria-hidden="true"
    >
      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="wishlist-btn-icon"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="wishlist-btn-icon"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

// ─── Wishlist Card Component ─────────────────────────────────────────────────
function WishlistCard({
  game,
  deal,
  freeGame,
  storeMap,
  alertSensitivity,
  now,
  onRemove,
  onUpdate,
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const isAlertsOn = game.notify !== false

  const coverImage = (!imgFailed && (game.image || deal?.thumb || freeGame?.thumbnail)) || ''
  const isConsole = isConsoleGame(game.platform)

  // A game is free if matched with a GamerPower giveaway OR a CheapShark 100% free deal
  const isDealFree = Boolean(
    deal && (
      deal.isFree ||
      Number(deal.savings) >= 100 ||
      Number(deal.salePrice) === 0
    )
  )
  const isFree = Boolean(!isConsole && (freeGame || isDealFree))
  const isOnSale = Boolean(
    !isConsole &&
    !isFree &&
    deal &&
    (deal.isOnSale === '1' || Number(deal.savings) > 0)
  )

  // Determine state
  let cardState = 'not_on_sale'
  if (isConsole) cardState = 'console'
  else if (isFree) cardState = 'free'
  else if (isOnSale) cardState = 'sale'

  // Lowest ever price and deal evaluation
  const cheapestEver = deal?.cheapest ? Number(deal.cheapest) : null
  const evalResult = isOnSale ? evaluateWishlistDeal(deal, alertSensitivity, cheapestEver) : { fires: false }

  const storeLabel = deal
    ? (formatStoreName(deal.storeName || storeMap.get(String(deal.storeID)) || STORE_NAMES[String(deal.storeID)]) || 'PC Store')
    : isFree
      ? (freeGame?.platforms ? freeGame.platforms.replace('PC, ', '') : 'Epic Games')
      : (game.platform || 'PC')

  const regularPrice = deal?.normalPrice
    ? Number(deal.normalPrice)
    : freeGame?.worth && freeGame.worth !== 'N/A'
      ? Number(String(freeGame.worth).replace(/[^0-9.]/g, ''))
      : null

  const claimUrl =
    freeGame?.open_giveaway_url ||
    freeGame?.gamerpower_url ||
    (deal?.dealID ? `https://www.cheapshark.com/redirect?dealID=${deal.dealID}` : null)

  const dealUrl = deal?.dealID
    ? `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`
    : null

  return (
    <article className="wishlist-card-redesign">
      {/* Full-bleed Card Background Image */}
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

      {/* Floating Top Bar (Tags & Actions) */}
      <div className="wishlist-card-top">
        <div className="wishlist-card-tags">
          {cardState === 'free' && (
            <span className="wishlist-tag wishlist-tag--free">FREE NOW</span>
          )}
          {cardState === 'sale' && (
            <>
              <span className="wishlist-tag wishlist-tag--sale">
                ON SALE {Number(deal.savings) > 0 ? `-${Math.round(Number(deal.savings))}%` : ''}
              </span>
              {evalResult.fires && evalResult.isNearLow && (
                <span className="wishlist-tag wishlist-tag--low">
                  {evalResult.isAllTimeLow ? 'ALL-TIME LOW' : 'NEAR LOW'}
                </span>
              )}
            </>
          )}
          {cardState === 'console' && (
            <span className="wishlist-tag wishlist-tag--console">CONSOLE</span>
          )}
          {cardState === 'not_on_sale' && (
            <span className="wishlist-tag wishlist-tag--neutral">NOT ON SALE</span>
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

      {/* Bottom Frosted Glass Overlay */}
      <div className="wishlist-card-bottom-overlay">
        <h2 className="wishlist-card-title" title={game.title}>
          {game.title}
        </h2>

        <div className="wishlist-card-meta">
          <span className="wishlist-store-chip">{storeLabel}</span>
          {game.platform && game.platform !== storeLabel && (
            <span className="wishlist-platform-text">{game.platform}</span>
          )}
        </div>

        {/* State-specific Pricing & CTAs */}
        {cardState === 'free' && (
          <div className="wishlist-details-group">
            <div className="wishlist-price-row">
              <span className="wishlist-price-free">Free</span>
              {regularPrice != null && regularPrice > 0 && (
                <del className="wishlist-price-old">{formatUsd(regularPrice)}</del>
              )}
              {freeGame?.end_date && (
                <span className="wishlist-countdown-chip">
                  {formatCountdown(freeGame.end_date, now)}
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
              <strong className="wishlist-price-sale">{formatUsd(deal.salePrice)}</strong>
              {Number(deal.normalPrice) > Number(deal.salePrice) && (
                <del className="wishlist-price-old">{formatUsd(deal.normalPrice)}</del>
              )}
              {cheapestEver != null && cheapestEver > 0 && (
                <span className="wishlist-lowest-chip" title="Historical lowest price">
                  Low {formatUsd(cheapestEver)}
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
            <div className="wishlist-price-row">
              <span className="wishlist-price-regular">
                {deal?.normalPrice || deal?.salePrice
                  ? formatUsd(deal.normalPrice || deal.salePrice)
                  : 'Price tracked on PC'}
              </span>
            </div>
          </div>
        )}

        {cardState === 'console' && (
          <div className="wishlist-details-group">
            <div className="wishlist-price-row">
              <span className="wishlist-console-badge">Console Exclusive</span>
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
  deals = [],
  session,
  onNavigate,
}) {
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [snapshotStores, setSnapshotStores] = useState([])
  const [snapshotDeals, setSnapshotDeals] = useState([])
  const [snapshotFree, setSnapshotFree] = useState([])
  const [liveDeals, setLiveDeals] = useState({})
  const [now, setNow] = useState(Date.now())

  // Header controls state
  const [sortBy, setSortBy] = useState('best') // 'best' | 'recent' | 'alpha'
  const [alertSensitivity, setAlertSensitivity] = useState(() => {
    try {
      return localStorage.getItem('lootradar_alert_sensitivity') || 'good'
    } catch {
      return 'good'
    }
  })

  // Live timer interval
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Load snapshots for deals, stores, and free games
  useEffect(() => {
    let cancelled = false
    fetch('/data/cheapshark-deals.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          if (Array.isArray(data.stores)) setSnapshotStores(data.stores)
          if (Array.isArray(data.deals)) setSnapshotDeals(data.deals)
        }
      })
      .catch(() => {})

    fetch('/data/gamerpower-free-games.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.games)) {
          setSnapshotFree(data.games)
        }
      })
      .catch(() => {})

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

    // Fetch user alert_sensitivity if present
    supabase
      .from('notification_settings')
      .select('alert_sensitivity')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.alert_sensitivity) {
          setAlertSensitivity(data.alert_sensitivity)
          try {
            localStorage.setItem('lootradar_alert_sensitivity', data.alert_sensitivity)
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
      localStorage.setItem('lootradar_alert_sensitivity', nextSensitivity)
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

  const storeMap = useMemo(() => {
    const map = new Map()
    snapshotStores.forEach((s) => map.set(String(s.storeID), s.storeName))
    return map
  }, [snapshotStores])

  const combinedDeals = useMemo(() => {
    const list = Array.isArray(deals) ? [...deals] : []
    const existing = new Set(list.map((d) => d.dealID))
    for (const d of snapshotDeals) {
      if (!existing.has(d.dealID)) list.push(d)
    }
    return list
  }, [deals, snapshotDeals])

  const combinedFreeGames = useMemo(() => {
    const list = Array.isArray(freeGames) ? [...freeGames] : []
    const existing = new Set(list.map((g) => g.id))
    for (const g of snapshotFree) {
      if (!existing.has(g.id)) list.push(g)
    }
    return list
  }, [freeGames, snapshotFree])

  const dealsByTitle = useMemo(() => {
    const match = new Map()
    combinedDeals.forEach((deal) => {
      const key = titleKey(deal.title)
      const existing = match.get(key)
      if (!existing || Number(deal.salePrice) < Number(existing.salePrice)) {
        match.set(key, deal)
      }
    })
    return match
  }, [combinedDeals])

  // Populate freeByTitle with both full title and cleaned title (stripping "(Epic Games) Giveaway", etc.)
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

  // Helper to find matching free game with fuzzy fallback
  function findFreeGame(title) {
    if (!title) return null
    const key = titleKey(title)
    if (freeByTitle.has(key)) return freeByTitle.get(key)
    const cleanKey = titleKey(normalizeFreeTitle(title))
    if (freeByTitle.has(cleanKey)) return freeByTitle.get(cleanKey)

    // Substring match
    for (const fg of combinedFreeGames) {
      const fgClean = titleKey(normalizeFreeTitle(fg.title))
      if (fgClean && (fgClean.includes(key) || key.includes(fgClean))) {
        return fg
      }
    }
    return null
  }

  // Fetch live deals for wishlisted PC games not in top 60 snapshot
  useEffect(() => {
    let cancelled = false
    const pending = games.filter((g) => {
      if (isConsoleGame(g.platform)) return false
      const key = titleKey(g.title)
      return !dealsByTitle.has(key) && !liveDeals[key]
    })

    if (pending.length === 0) return

    pending.slice(0, 15).forEach(async (g) => {
      const key = titleKey(g.title)
      try {
        const cleanQuery = g.title.replace(/\s*\(.*?\)/g, '').trim()
        const res = await fetch(
          `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(cleanQuery)}&pageSize=1`
        )
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data) && data[0]) {
          setLiveDeals((prev) => ({
            ...prev,
            [key]: data[0],
          }))
        }
      } catch {}
    })

    return () => {
      cancelled = true
    }
  }, [games, dealsByTitle, liveDeals])

  // Count games currently on sale or free
  const saleOrFreeCount = useMemo(() => {
    return games.filter((g) => {
      if (isConsoleGame(g.platform)) return false
      const key = titleKey(g.title)
      const free = findFreeGame(g.title)
      const deal = dealsByTitle.get(key) || liveDeals[key]
      const isDealFree = Boolean(
        deal && (deal.isFree || Number(deal.savings) >= 100 || Number(deal.salePrice) === 0)
      )
      const isFree = Boolean(free || isDealFree)
      const isOnSale = Boolean(!isFree && deal && (deal.isOnSale === '1' || Number(deal.savings) > 0))
      return isFree || isOnSale
    }).length
  }, [games, freeByTitle, dealsByTitle, liveDeals, combinedFreeGames])

  // Sorted games
  const sortedGames = useMemo(() => {
    const list = [...games]
    if (sortBy === 'recent') {
      return list.reverse()
    }
    if (sortBy === 'alpha') {
      return list.sort((a, b) => a.title.localeCompare(b.title))
    }
    // Default: 'best' deals first
    return list.sort((a, b) => {
      const keyA = titleKey(a.title)
      const keyB = titleKey(b.title)
      const freeA = findFreeGame(a.title) || (liveDeals[keyA] && Number(liveDeals[keyA].savings) >= 100) ? 1 : 0
      const freeB = findFreeGame(b.title) || (liveDeals[keyB] && Number(liveDeals[keyB].savings) >= 100) ? 1 : 0
      if (freeA !== freeB) return freeB - freeA

      const dealA = dealsByTitle.get(keyA) || liveDeals[keyA]
      const dealB = dealsByTitle.get(keyB) || liveDeals[keyB]
      const savingsA = dealA ? Number(dealA.savings || 0) : -1
      const savingsB = dealB ? Number(dealB.savings || 0) : -1
      if (savingsA !== savingsB) return savingsB - savingsA

      const priceA = dealA ? Number(dealA.salePrice || 9999) : 9999
      const priceB = dealB ? Number(dealB.salePrice || 9999) : 9999
      return priceA - priceB
    })
  }, [games, sortBy, freeByTitle, dealsByTitle, liveDeals, combinedFreeGames])

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
      {/* ─── Page Header & Tabs ─── */}
      <header className="wishlist-header">
        <div className="wishlist-header__main">
          <h1>Wishlist</h1>
          <div className="wishlist-tabs" role="tablist" aria-label="Collections tabs">
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="wishlist-tab is-active"
            >
              Wishlist <span className="wishlist-tab__count">{games.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              className="wishlist-tab"
              onClick={() => onNavigate('library')}
            >
              Owned <span className="wishlist-tab__count">{ownedGames.length}</span>
            </button>
          </div>
        </div>

        {/* ─── Controls: Sort & Alert Sensitivity ─── */}
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

      {/* ─── Status Banner ─── */}
      <section className="wishlist-banner" aria-label="Wishlist status summary">
        <div className="wishlist-banner__info">
          <span className="wishlist-banner__indicator" aria-hidden="true" />
          <p>
            <strong>{saleOrFreeCount} of your games</strong> are on sale or free right now
          </p>
        </div>
        <div className="wishlist-banner__telegram">
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

      {/* ─── Cards Grid or Empty State ─── */}
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
              onClick={() => onNavigate('free')}>
              See Free Now
            </button>
          </div>
        </div>
      ) : (
        <div className="wishlist-grid-redesign">
          {sortedGames.map((game, index) => {
            const key = titleKey(game.title)
            const deal = dealsByTitle.get(key) || liveDeals[key] || null
            const freeGame = findFreeGame(game.title)
            return (
              <WishlistCard
                key={`${key}-${index}`}
                game={game}
                deal={deal}
                freeGame={freeGame}
                storeMap={storeMap}
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
  )
}
