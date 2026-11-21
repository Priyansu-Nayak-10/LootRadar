import { useEffect, useState } from 'react'

export default function Rumors() {
  const [games, setGames] = useState([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/data/rumored-free-games.json')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (!cancelled) {
          setGames(Array.isArray(data.games) ? data.games : [])
          setNotice(data.notice || '')
        }
      })
      .catch(() => {
        if (!cancelled) setNotice('Rumor data could not be loaded.')
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
      <div className="api-setup-hint">
        <strong>Rumors are unconfirmed</strong>
        {notice && <p>{notice}</p>}
        <small>Nothing here is a confirmed giveaway until a store or publisher announces it.</small>
      </div>
      {loading ? (
        <p className="empty-state">Loading rumors...</p>
      ) : games.length === 0 ? (
        <p className="empty-state">No verified rumors have been added yet.</p>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <article className="game-card" key={game.title}>
              {game.image ? (
                <img src={game.image} alt={game.title} loading="lazy" className="game-card-image" />
              ) : (
                <div className="game-card-image discovery-no-image">RUMOR</div>
              )}
              <div className="game-card-content">
                <span className="availability-badge is-sale">Rumor - unconfirmed</span>
                <h2 className="game-title">{game.title}</h2>
                {game.summary && <p className="game-platform">{game.summary}</p>}
                {game.sourceUrl && (
                  <a href={game.sourceUrl} target="_blank" rel="noreferrer" className="game-card-cta">
                    View report <span aria-hidden="true">-&gt;</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
