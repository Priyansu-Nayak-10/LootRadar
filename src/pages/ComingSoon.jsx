import { useEffect, useState } from 'react'

export default function ComingSoon() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/data/epic-free-games.json')
      .then((response) => {
        if (!response.ok) throw new Error('Snapshot unavailable')
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setGames(Array.isArray(data.upcoming) ? data.upcoming : [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load confirmed upcoming free games.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="coming-soon-redesign">
      <header className="redesign-page-header">
        <div>
          <span className="lr-section-heading__kicker">EPIC CONFIRMATIONS</span>
          <h1>Coming <strong>Soon</strong></h1>
        </div>
        <span className="lr-badge">{games.length} confirmed</span>
      </header>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? (
        <div className="lr-skeleton" />
      ) : (
        <div className="game-grid coming-soon-grid">
          {games.map((game) => (
            <article className="lr-game-card coming-soon-card" key={game.id}>
              {game.image ? (
                <img src={game.image} alt={game.title} loading="lazy" decoding="async" className="lr-game-card__image" />
              ) : (
                <div className="lr-art-fallback">CONFIRMED GAME</div>
              )}
              <div className="lr-game-card__body coming-soon-card__body">
                <span className="lr-badge lr-badge--lime">Confirmed by Epic</span>
                <h2 className="coming-soon-card__title">{game.title}</h2>
                <p className="game-platform">
                  Starts {new Date(game.startDate).toLocaleString('en-IN')}
                </p>
                <a
                  href={`https://store.epicgames.com/en-US/p/${game.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="lr-button lr-button--secondary"
                >
                  View on Epic <span aria-hidden="true">-&gt;</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && games.length === 0 && (
        <p className="empty-state">No upcoming Epic free games are confirmed right now.</p>
      )}
    </section>
  )
}
