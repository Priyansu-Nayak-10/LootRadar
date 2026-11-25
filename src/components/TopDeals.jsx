import { useMemo } from 'react'
import DealCard from './DealCard'
import {
  selectTopDeals,
  useDeals,
} from '../lib/dealsData'

export default function TopDeals({ getGameActions, onNavigate }) {
  const { deals, loading, error, reload } = useDeals()
  const topDeals = useMemo(() => selectTopDeals(deals, 8), [deals])

  return (
    <section className="top-deals" aria-labelledby="top-deals-heading">
      <header className="lr-section-heading">
        <div className="lr-section-heading__copy">
          <span className="lr-section-heading__kicker">INDIA PC SAVINGS</span>
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
          topDeals.map((deal) => (
            <DealCard
              key={deal.itadId}
              deal={deal}
              getGameActions={getGameActions}
            />
          ))}

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
