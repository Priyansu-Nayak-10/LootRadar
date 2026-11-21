import { useEffect, useState } from 'react'
import GameActions from '../components/GameActions'

export default function AlwaysFree({ getGameActions }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [platform, setPlatform] = useState('All')

  useEffect(() => {
    let cancelled = false
    fetch('/data/always-free-games.json')
      .then((response) => {
        if (!response.ok) throw new Error('Snapshot unavailable')
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setGames(Array.isArray(data.games) ? data.games : [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load always-free games. Please try again later.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const platforms = ['All', 'PC', 'Browser']
  const shown = games.filter((game) => {
    if (platform === 'All') return true
    if (platform === 'Browser') return game.platform === 'Web Browser'
    return game.platform.includes('Windows')
  })

  return (
    <section className="always-free-redesign">
      <header className="redesign-page-header">
        <div>
          <span className="lr-section-heading__kicker">FREE TO PLAY</span>
          <h1>Always <strong>Free</strong></h1>
        </div>
        <span className="lr-badge">{shown.length} games</span>
      </header>
      <div className="filter-toolbar always-free-filters" aria-label="Filter always-free games">
        {platforms.map((option) => (
          <button
            key={option}
            type="button"
            className={`filter-chip ${platform === option ? 'is-selected' : ''}`}
            aria-pressed={platform === option}
            onClick={() => setPlatform(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? (
        <div className="lr-skeleton" />
      ) : (
        <div className="game-grid always-free-grid">
          {shown.map((game) => {
            const actions = getGameActions({
              title: game.title,
              platform: game.platform,
              image: game.thumbnail,
              source: 'always-free',
              sourceId: game.id,
            })
            return (
              <article className="lr-game-card always-free-card" key={game.id}>
                {game.thumbnail ? (
                  <img src={game.thumbnail} alt={game.title} loading="lazy" decoding="async" className="lr-game-card__image" />
                ) : (
                  <div className="lr-art-fallback">ALWAYS FREE</div>
                )}
                <div className="lr-game-card__body always-free-card__body">
                  <span className="lr-badge lr-badge--lime">Always Free</span>
                  <h2 className="always-free-card__title">{game.title}</h2>
                  <p className="game-platform">{game.platform} · {game.genre}</p>
                  <GameActions {...actions} />
                  <a href={game.gameUrl} target="_blank" rel="noreferrer" className="lr-button lr-button--secondary">
                    Play game <span aria-hidden="true">→</span>
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {!loading && !error && shown.length === 0 && (
        <p className="empty-state">No always-free games match this platform.</p>
      )}
      <p className="discover-source-note">
        Data from <a href="https://www.freetogame.com" target="_blank" rel="noreferrer">FreeToGame</a>.
      </p>
    </section>
  )
}
