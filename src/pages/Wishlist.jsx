import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function titleKey(title = '') {
  return title.trim().toLocaleLowerCase()
}

function formatUsd(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)} USD` : ''
}

function alertSummary(game) {
  const alerts = []
  if (game.alertOnFree !== false) alerts.push('Free')
  if (game.alertDiscountPercent !== '' && game.alertDiscountPercent != null) alerts.push(`-${game.alertDiscountPercent}%`)
  if (game.alertTargetPrice !== '' && game.alertTargetPrice != null) alerts.push(`Under ${formatUsd(game.alertTargetPrice)}`)
  return alerts.length ? alerts.join(' · ') : 'No price alerts'
}

function WishlistCard({
  game,
  deal,
  freeGame,
  storeMap,
  onGameOpen,
  onRemove,
  onUpdate,
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const isFree = Boolean(freeGame)
  const coverImage = (!imgFailed && (game.image || deal?.thumb || freeGame?.thumbnail)) || ''

  const priceLabel = isFree
    ? 'Free now'
    : deal
      ? formatUsd(deal.salePrice)
      : 'Not released'

  const storeLabel = deal
    ? (deal.storeName || storeMap.get(String(deal.storeID)) || 'Steam')
    : isFree
      ? (freeGame?.platforms || game.platform || 'Current giveaway')
      : (game.platform || 'Store TBA')

  return (
    <article
      className="wishlist-detail-card"
      onClick={() => onGameOpen(game.title)}
    >
      {coverImage ? (
        <img
          src={coverImage}
          alt={game.title}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="wishlist-detail-card__image"
        />
      ) : (
        <div className="wishlist-detail-card__fallback" aria-hidden="true">
          {game.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="wishlist-detail-card__content">
        <div className="wishlist-detail-card__heading">
          <h2>{game.title}</h2>
          <button
            type="button"
            className="wishlist-remove"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(game.title)
            }}
          >
            Remove
          </button>
        </div>
        <p className="wishlist-detail-card__platform">{game.platform || 'Platform not set'}</p>
        <dl className="wishlist-detail-card__facts">
          <div>
            <dt>Best price</dt>
            <dd style={{ color: isFree || deal ? 'var(--lime)' : 'inherit', fontWeight: 750 }}>
              {priceLabel}
            </dd>
          </div>
          <div>
            <dt>Store</dt>
            <dd>{storeLabel}</dd>
          </div>
          <div>
            <dt>Alerts</dt>
            <dd>{alertSummary(game)}</dd>
          </div>
        </dl>
        <fieldset
          className="wishlist-alert-settings"
          onClick={(event) => event.stopPropagation()}
        >
          <legend>Alert settings</legend>
          <label>
            <input
              type="checkbox"
              checked={game.alertOnFree !== false}
              onChange={(event) => onUpdate(game.title, { alertOnFree: event.target.checked })}
            />{' '}
            Notify when free
          </label>
          <label>
            Discount at least{' '}
            <input
              type="number"
              min="1"
              max="100"
              placeholder="%"
              value={game.alertDiscountPercent ?? ''}
              onChange={(event) => onUpdate(game.title, { alertDiscountPercent: event.target.value })}
            />
          </label>
          <label>
            Target price{' '}
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="USD"
              value={game.alertTargetPrice ?? ''}
              onChange={(event) => onUpdate(game.title, { alertTargetPrice: event.target.value })}
            />
          </label>
        </fieldset>
      </div>
    </article>
  )
}

export default function Wishlist({ games, setGames, freeGames = [], deals = [], session, onNavigate, onGameOpen }) {
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [snapshotStores, setSnapshotStores] = useState([])
  const [snapshotDeals, setSnapshotDeals] = useState([])
  const [snapshotFree, setSnapshotFree] = useState([])

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

  useEffect(() => {
    if (!session || !supabase) {
      setTelegramConnected(false)
      return undefined
    }
    let cancelled = false
    supabase.from('telegram_connections').select('user_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setTelegramConnected(Boolean(data)) })
      .catch(() => { if (!cancelled) setTelegramConnected(false) })
    return () => { cancelled = true }
  }, [session])

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
      if (!existing || Number(deal.salePrice) < Number(existing.salePrice)) match.set(key, deal)
    })
    return match
  }, [combinedDeals])

  const freeByTitle = useMemo(() => {
    const match = new Map()
    combinedFreeGames.forEach((game) => {
      match.set(titleKey(game.title), game)
    })
    return match
  }, [combinedFreeGames])

  function updateGame(title, updates) {
    setGames((current) => current.map((game) => titleKey(game.title) === titleKey(title) ? { ...game, ...updates } : game))
  }

  function removeGame(titleToRemove) {
    setGames((current) => current.filter((game) => titleKey(game.title) !== titleKey(titleToRemove)))
  }

  return (
    <section className="collections-redesign wishlist-redesign">
      <header className="redesign-page-header">
        <div><span className="lr-section-heading__kicker">SAVED FOR LATER</span><h1>My <strong>Wishlist</strong></h1></div>
        <span className="lr-badge">{games.length} games</span>
      </header>

      <section className="wishlist-telegram-status" aria-label="Telegram status">
        <div><strong>{telegramConnected ? 'Telegram connected' : 'Telegram not connected'}</strong><span>{telegramConnected ? 'Wishlist alerts can be delivered to your linked Telegram account.' : 'Connect Telegram to receive wishlist alerts.'}</span></div>
        <button type="button" className="lr-button" onClick={() => onNavigate('account')}>{telegramConnected ? 'Manage Telegram' : 'Connect Telegram'}</button>
      </section>

      {games.length === 0 ? (
        <div className="empty-state wishlist-empty-state"><p>Your Wishlist is waiting for its next great game.</p><div><button type="button" className="lr-button" onClick={() => onNavigate('deals')}>Browse Deals</button><button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('free')}>See Free Now</button></div></div>
      ) : (
        <div className="wishlist-detail-grid">
          {games.map((game, index) => {
            const deal = dealsByTitle.get(titleKey(game.title))
            const freeGame = freeByTitle.get(titleKey(game.title))
            return (
              <WishlistCard
                key={`${titleKey(game.title)}-${index}`}
                game={game}
                deal={deal}
                freeGame={freeGame}
                storeMap={storeMap}
                onGameOpen={onGameOpen}
                onRemove={removeGame}
                onUpdate={updateGame}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
