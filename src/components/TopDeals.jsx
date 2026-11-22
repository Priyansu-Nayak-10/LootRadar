import { useEffect, useMemo, useState } from 'react'

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : ''
}

export default function TopDeals({ getGameActions, onNavigate }) {
  const [deals, setDeals] = useState([])

  useEffect(() => {
    let cancelled = false
    fetch('/data/cheapshark-deals.json')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (!cancelled) setDeals(Array.isArray(data.deals) ? data.deals : []) })
      .catch(() => { if (!cancelled) setDeals([]) })
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
      <div className="top-deals__row">
        {topDeals.map((deal) => {
          const actions = getGameActions({ title: deal.title, platform: 'PC', image: deal.thumb, source: 'deal', sourceId: deal.dealID })
          return (
            <article className="top-deals__card" key={deal.dealID}>
              {deal.thumb ? <img src={deal.thumb} alt="" loading="lazy" /> : <div className="lr-art-fallback">DEAL</div>}
              <div>
                <span className="lr-badge lr-badge--lime">-{Math.round(Number(deal.savings))}%</span>
                <h3>{deal.title}</h3>
                <p><del>{money(deal.normalPrice)}</del> <strong>{money(deal.salePrice)}</strong></p>
                <button type="button" className={`top-deals__wishlist ${actions.wishlisted ? 'is-active' : ''}`} onClick={actions.onToggleWishlist} aria-label={`Toggle ${deal.title} wishlist`}>♥</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
