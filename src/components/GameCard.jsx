import { useState } from 'react'

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function resizedRawgImage(url) {
  if (!url) return ''
  return url.replace('/media/', '/media/resize/480/-/')
}

export { normalizeTitle }

export default function GameCard({ game, rank, deal, actions }) {
  const [imageSource, setImageSource] = useState(resizedRawgImage(game.background_image))
  const platformNames = (game.platforms || [])
    .map((item) => item.platform?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
  const imageFallback = game.name?.trim().slice(0, 1).toUpperCase() || 'G'
  const hasPrice = Boolean(deal) && platformNames.includes('PC')
  const savings = deal ? Math.round(Number(deal.savings)) : 0
  const salePrice = deal ? Number(deal.salePrice) : 0

  function handleImageError() {
    if (imageSource !== game.background_image && game.background_image) {
      setImageSource(game.background_image)
      return
    }
    setImageSource('')
  }

  return (
    <article className="popular-game-card" tabIndex="0">
      <div className="popular-game-card__art">
        {imageSource ? (
          <img src={imageSource} alt="" loading="lazy" decoding="async" onError={handleImageError} />
        ) : (
          <div className="popular-game-card__fallback" aria-hidden="true">{imageFallback}</div>
        )}
        <div className="popular-game-card__fade" />
        <span className="popular-game-card__rank">{String(rank).padStart(2, '0')}</span>
        <button
          type="button"
          className={`popular-game-card__heart ${actions.wishlisted ? 'is-active' : ''}`}
          aria-label={`${actions.wishlisted ? 'Remove' : 'Add'} ${game.name} ${actions.wishlisted ? 'from' : 'to'} wishlist`}
          onClick={actions.onToggleWishlist}
        >
          ♥
        </button>
        {Number(game.metacritic || game.rating) > 0 && (
          <span className="popular-game-card__rating">
            {game.metacritic ? `MC ${game.metacritic}` : `★ ${game.rating}`}
          </span>
        )}
        {hasPrice && (
          <div className="popular-game-card__prices">
            {salePrice === 0 ? (
              <span className="popular-game-card__free">Free</span>
            ) : (
              <>
                {savings > 0 && <span className="popular-game-card__discount">-{savings}%</span>}
                <del>${Number(deal.normalPrice).toFixed(2)}</del>
                <strong>${salePrice.toFixed(2)}</strong>
              </>
            )}
          </div>
        )}
      </div>
      <div className="popular-game-card__body">
        <h3>{game.name}</h3>
        <p>{platformNames}{game.genres?.[0]?.name ? ` · ${game.genres[0].name}` : ''}</p>
      </div>
    </article>
  )
}
