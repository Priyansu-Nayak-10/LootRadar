import { useMemo } from 'react'
import DealCard from './DealCard'
import {
  formatStoreName,
  STORE_NAMES,
  selectTopDeals,
  useTopDeals,
} from '../lib/dealsData'

export default function TopDeals({ getGameActions, onNavigate }) {
  const { deals, stores, loading, error, reload } = useTopDeals()
  const topDeals = useMemo(() => selectTopDeals(deals), [deals])

  return (
    <section className="top-deals" aria-labelledby="top-deals-heading">
      <header className="lr-section-heading">
        <div className="lr-section-heading__copy">
          <span className="lr-section-heading__kicker">PC SAVINGS</span>
          <h2 id="top-deals-heading">
            Top <strong>Deals</strong>
          </h2>
        </div>
        <button
          type="button"
          className="lr-button lr-button--ghost"
          onClick={() => onNavigate('deals')}
        >
          View All
        </button>
      </header>

      <div className="top-deals__row" aria-busy={loading}>
        {loading &&
          Array.from({ length: 8 }, (_, index) => (
            <div
              className="top-deals__skeleton lr-skeleton"
              key={index}
              aria-hidden="true"
            />
          ))}

        {!loading &&
          topDeals.map((deal) => {
            const storeName = formatStoreName(
              stores.find((s) => String(s.storeID) === String(deal.storeID))?.storeName ||
                STORE_NAMES[String(deal.storeID)]
            )
            return (
              <DealCard
                key={deal.dealID}
                deal={deal}
                storeName={storeName}
                getGameActions={getGameActions}
              />
            )
          })}

        {!loading && (topDeals.length === 0 || error) && (
          <div className="top-deals__empty">
            <p>Could not load PC deals right now.</p>
            <button
              type="button"
              className="lr-button lr-button--secondary"
              onClick={reload}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
