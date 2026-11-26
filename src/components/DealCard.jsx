import SafeImage from './SafeImage'
import {
  formatStoreName,
  formatDealPrice,
  formatDealExpiry,
} from '../lib/dealsData'
import {
  FlameIcon,
  HeartIcon,
  CheckIcon,
  PcIcon,
  StoreIcon,
} from './icons'

export default function DealCard({
  deal,
  getGameActions,
}) {
  if (!deal || !deal.itadId) return null

  const resolvedStore = formatStoreName(deal.shop?.name || 'PC Store')
  const discount = Math.round(Number(deal.cut || 0))
  const salePrice = Number(deal.price || 0)
  const regularPrice = Number(deal.regular || 0)
  const historyLow = deal.historyLow != null ? Number(deal.historyLow) : null
  const expiryLabel = formatDealExpiry(deal.expiry)

  const actions =
    typeof getGameActions === 'function'
      ? getGameActions({
          title: deal.title || 'Game',
          platform: resolvedStore,
          image: deal.image,
          source: 'deal',
          sourceId: deal.itadId,
          url: deal.url,
        })
      : { owned: false, wishlisted: false, onToggleOwned: () => {}, onToggleWishlist: () => {} }

  return (
    <article className="deal-card-redesign">
      <div className="deal-card__media">
        <SafeImage
          steamAppID={deal.steamAppId}
          src={deal.image}
          alt={deal.title}
          className="deal-card__image"
          fallbackText={deal.title?.slice(0, 1)}
        />

        {discount > 0 && (
          <span className="deal-card__badge-discount">-{discount}%</span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          className={`deal-card__heart-btn ${actions.wishlisted ? 'is-active' : ''}`}
          aria-label={actions.wishlisted ? `Remove ${deal.title} from wishlist` : `Add ${deal.title} to wishlist`}
          title={actions.wishlisted ? 'In Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon active={actions.wishlisted} />
        </button>

        {deal.isLowestEver ? (
          <span className="deal-card__flag deal-card__flag--lowest">
            <FlameIcon /> Lowest ever
          </span>
        ) : deal.isNewLow ? (
          <span className="deal-card__flag deal-card__flag--great">
            New low
          </span>
        ) : null}
      </div>

      <div className="deal-card__body">
        <h3 className="deal-card__title" title={deal.title}>
          {deal.title}
        </h3>

        <div className="deal-card__meta-row">
          <div className="deal-card__platform-store">
            <PcIcon size={14} className="deal-card__pc-icon" />
            <span className="deal-card__store-chip">
              <StoreIcon store={resolvedStore} size={13} />
              {resolvedStore}
            </span>
          </div>
          {expiryLabel && (
            <span className="deal-card__expiry">{expiryLabel}</span>
          )}
        </div>

        <div className="deal-card__prices-row">
          <strong className="deal-card__sale-price">
            {formatDealPrice(salePrice)}
          </strong>
          {regularPrice > salePrice && (
            <del className="deal-card__old-price">
              {formatDealPrice(regularPrice)}
            </del>
          )}
        </div>

        <div className="deal-card__lowest-line">
          {historyLow != null && Number.isFinite(historyLow) ? (
            <span>Lowest ever {formatDealPrice(historyLow)}</span>
          ) : (
            <span className="deal-card__lowest-muted">Lowest price not available</span>
          )}
        </div>

        <div className="deal-card__actions-row">
          <a
            href={deal.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="deal-card__cta-btn"
          >
            Get deal
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              actions.onToggleOwned()
            }}
            className={`deal-card__owned-btn ${actions.owned ? 'is-active' : ''}`}
            aria-label={actions.owned ? `Mark ${deal.title} as not owned` : `Mark ${deal.title} as owned`}
            title={actions.owned ? 'Owned in Library' : 'I own this'}
          >
            <CheckIcon active={actions.owned} />
          </button>
        </div>
      </div>
    </article>
  )
}
