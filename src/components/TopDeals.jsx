import { useEffect, useMemo, useState } from 'react'
import cachedFetch from '../lib/cachedFetch'

const CHEAPSHARK_DEALS = 'https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=Savings&desc=1'

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : ''
}

function DealArt({ deal }) {
  const [failed, setFailed] = useState(false)
  const initial = (deal.title || 'D').trim().charAt(0).toUpperCase()

  if (!deal.thumb || failed) return <div className="lr-art-fallback top-deals__art-fallback" aria-hidden="true">{initial}</div>

  return <img src={deal.thumb} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

export default function TopDeals({ getGameActions, onNavigate, onGameOpen }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDeals() {
      try {
        const response = await fetch('/data/cheapshark-deals.json')
        const snapshot = response.ok ? await response.json() : null
        let loadedDeals = Array.isArray(snapshot?.deals) ? snapshot.deals : []

        // The checked-in snapshot may be between deal refreshes. Only fall back to
        // CheapShark when it cannot satisfy the visible 20% minimum.
        if (!loadedDeals.some((deal) => Number(deal.savings) >= 20)) {
          const liveDeals = await cachedFetch(CHEAPSHARK_DEALS)
          if (Array.isArray(liveDeals)) loadedDeals = liveDeals
        }

        if (!cancelled) setDeals(loadedDeals)
      } catch {
        if (!cancelled) setDeals([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDeals()
    return () => { cancelled = true }
  }, [])

  const topDeals = useMemo(() => deals
    .filter((deal) => Number(deal.savings) >= 20)
    .sort((a, b) => Number(b.savings) - Number(a.savings))
    .slice(0, 6), [deals])

  return (
    <section className="top-deals" aria-labelledby="top-deals-heading">
      <header className="lr-section-heading">
        <div className="lr-section-heading__copy">
          <span className="lr-section-heading__kicker">PC SAVINGS</span>
          <h2 id="top-deals-heading">Top <strong>Deals</strong></h2>
        </div>
        <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('deals')}>View All</button>
      </header>
      <div className="top-deals__row" aria-busy={loading}>
        {loading && Array.from({ length: 6 }, (_, index) => <div className="top-deals__skeleton lr-skeleton" key={index} aria-hidden="true" />)}
        {!loading && topDeals.map((deal) => {
          const actions = getGameActions({ title: deal.title, platform: 'PC', image: deal.thumb, source: 'deal', sourceId: deal.dealID })
          return (
            <article className="top-deals__card" key={deal.dealID} onClick={() => onGameOpen(deal.title)}>
              <DealArt deal={deal} />
              <div>
                <span className="lr-badge lr-badge--lime">-{Math.round(Number(deal.savings))}%</span>
                <h3>{deal.title}</h3>
                <p><del>{money(deal.normalPrice)}</del> <strong>{money(deal.salePrice)}</strong></p>
                <button type="button" className={`top-deals__wishlist ${actions.wishlisted ? 'is-active' : ''}`} onClick={(event) => { event.stopPropagation(); actions.onToggleWishlist() }} aria-label={`Toggle ${deal.title} wishlist`}>♥</button>
              </div>
            </article>
          )
        })}
        {!loading && topDeals.length === 0 && (
          <div className="top-deals__empty">
            No PC deals of 20% or more are available right now. <button type="button" onClick={() => onNavigate('deals')}>Browse all deals</button>
          </div>
        )}
      </div>
    </section>
  )
}
