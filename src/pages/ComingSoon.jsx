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
    <section>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading confirmed Epic free games...</p>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <article className="game-card" key={game.id}>
              {game.image ? (
                <img src={game.image} alt={game.title} loading="lazy" className="game-card-image" />
              ) : (
                <div className="game-card-image discovery-no-image">GAME</div>
              )}
              <div className="game-card-content">
                <span className="availability-badge">Confirmed by Epic</span>
                <h2 className="game-title">{game.title}</h2>
                <p className="game-platform">
                  Starts {new Date(game.startDate).toLocaleString('en-IN')}
                </p>
                <a
                  href={`https://store.epicgames.com/en-US/p/${game.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="game-card-cta"
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
