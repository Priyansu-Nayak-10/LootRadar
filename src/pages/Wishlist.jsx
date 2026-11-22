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

export default function Wishlist({ games, setGames, freeGames, deals, session, onNavigate, onGameOpen }) {
  const [telegramConnected, setTelegramConnected] = useState(false)

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

  const dealsByTitle = useMemo(() => {
    const match = new Map()
    deals.forEach((deal) => {
      const key = titleKey(deal.title)
      const existing = match.get(key)
      if (!existing || Number(deal.salePrice) < Number(existing.salePrice)) match.set(key, deal)
    })
    return match
  }, [deals])

  const freeTitles = useMemo(() => new Set(freeGames.map((game) => titleKey(game.title))), [freeGames])

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
            const isFree = freeTitles.has(titleKey(game.title))
            const priceLabel = isFree ? 'Free now' : deal ? formatUsd(deal.salePrice) : 'Not released'
            const storeLabel = isFree ? 'Current giveaway' : deal ? 'CheapShark deal' : 'No current store price'
            return <article key={`${titleKey(game.title)}-${index}`} className="wishlist-detail-card" onClick={() => onGameOpen(game.title)}>
              {game.image ? <img src={game.image} alt="" loading="lazy" /> : <div className="wishlist-detail-card__fallback" aria-hidden="true">{game.title.slice(0, 1).toUpperCase()}</div>}
              <div className="wishlist-detail-card__content">
                <div className="wishlist-detail-card__heading"><h2>{game.title}</h2><button type="button" className="wishlist-remove" onClick={(event) => { event.stopPropagation(); removeGame(game.title) }}>Remove</button></div>
                <p className="wishlist-detail-card__platform">{game.platform || 'Platform not set'}</p>
                <dl className="wishlist-detail-card__facts"><div><dt>Best price</dt><dd>{priceLabel}</dd></div><div><dt>Store</dt><dd>{storeLabel}</dd></div><div><dt>Alerts</dt><dd>{alertSummary(game)}</dd></div></dl>
                <fieldset className="wishlist-alert-settings" onClick={(event) => event.stopPropagation()}><legend>Alert settings</legend>
                  <label><input type="checkbox" checked={game.alertOnFree !== false} onChange={(event) => updateGame(game.title, { alertOnFree: event.target.checked })} /> Notify when free</label>
                  <label>Discount at least <input type="number" min="1" max="100" placeholder="%" value={game.alertDiscountPercent ?? ''} onChange={(event) => updateGame(game.title, { alertDiscountPercent: event.target.value })} /></label>
                  <label>Target price <input type="number" min="0" step="0.01" placeholder="USD" value={game.alertTargetPrice ?? ''} onChange={(event) => updateGame(game.title, { alertTargetPrice: event.target.value })} /></label>
                </fieldset>
              </div>
            </article>
          })}
        </div>
      )}
    </section>
  )
}
