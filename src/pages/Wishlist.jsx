function titleKey(title) {
  return title.trim().toLocaleLowerCase()
}

function getBadges(game, freeGames, deals) {
  const key = titleKey(game.title)
  const badges = []

  if (freeGames.some((freeGame) => titleKey(freeGame.title) === key)) {
    badges.push({ label: 'Now free!', variant: '' })
  }

  const discounts = deals
    .filter((deal) => titleKey(deal.title) === key)
    .map((deal) => Math.round(Number(deal.savings)))
    .filter(Number.isFinite)
  if (discounts.length > 0) {
    const bestDiscount = Math.max(...discounts)
    if (Number.isFinite(bestDiscount)) {
      badges.push({
        label: `On sale: -${bestDiscount}%`,
        variant: 'is-sale',
      })
    }
  }

  return badges
}

export default function Wishlist({ games, setGames, freeGames, deals }) {
  function removeGame(titleToRemove) {
    setGames((current) =>
      current.filter((game) => titleKey(game.title) !== titleKey(titleToRemove))
    )
  }

  return (
    <section className="collection-section">
      <h2 className="section-heading">
        My wishlist <span className="section-count">({games.length})</span>
      </h2>

      {games.length === 0 ? (
        <p className="empty-state">
          Your Wishlist is empty. Browse Free Now or Deals and choose Add to wishlist on a game you like.
        </p>
      ) : (
        <div className="collection-grid">
          {games.map((game, index) => {
            const badges = getBadges(game, freeGames, deals)
            return (
              <article
                key={`${titleKey(game.title)}-${index}`}
                className="wishlist-card"
              >
              {game.image ? (
                <img
                  src={game.image}
                  alt=""
                  loading="lazy"
                  className="collection-image"
                />
              ) : (
                <div
                  className="collection-fallback"
                  aria-hidden="true"
                >
                  GAME
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="collection-title">{game.title}</h3>
                <p className="collection-platform">
                  {game.platform || 'Platform not set'}
                </p>
                {badges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={`availability-badge ${badge.variant}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeGame(game.title)}
                  className="remove-button"
                >
                  Remove from wishlist
                </button>
              </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
