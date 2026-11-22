import { useEffect, useState } from 'react'

const API = 'https://www.gamerpower.com/api/giveaways?type=game'
const CACHE_KEY = 'lootradar_free'
const CACHE_MS = 10 * 60 * 1000

const FILTERS = [
  { label: 'All', match: '' },
  { label: 'Epic', match: 'epic' },
  { label: 'Steam', match: 'steam' },
  { label: 'GOG', match: 'gog' },
  { label: 'itch.io', match: 'itch' },
]

function timeLeft(endDate, now) {
  if (!endDate || endDate === 'N/A') return null
  const end = new Date(endDate.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(end)) return null
  const diff = end - now
  if (diff <= 0) return { text: 'Ended', urgent: true }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return { text: `${d}d ${h}h left`, urgent: false }
  return { text: `${h}h ${m}m left`, urgent: true }
}

function SkeletonCard() {
  return (
    <div className="lr-skeleton free-now-skeleton" aria-hidden="true" />
  )
}

function GameCard({ game, now, getGameActions }) {
  const left = timeLeft(game.end_date, now)
  const actions = getGameActions({
    title: game.title,
    platform: game.platforms,
    image: game.thumbnail,
    source: 'free',
    sourceId: game.id,
  })
  return (
    <article className="lr-game-card free-now-card">
      {game.thumbnail ? (
        <img
          src={game.thumbnail}
          alt={game.title}
          loading="lazy"
          decoding="async"
          className="lr-game-card__image"
        />
      ) : (
        <div className="lr-art-fallback">FREE GAME</div>
      )}
      <div className="lr-game-card__body free-now-card__body">
        <div className="free-now-card__meta">
          <span className="lr-badge lr-badge--lime">FREE</span>
          {left && <span className={`lr-badge ${left.urgent ? 'is-urgent' : ''}`}>{left.text}</span>}
        </div>
        <h2 className="free-now-card__title">{game.title}</h2>
        <p className="game-platform">{game.platforms}</p>
        {game.worth && game.worth !== 'N/A' && (
          <p className="free-now-card__worth">Usually {game.worth} USD</p>
        )}
        <div className="free-now-card__actions">
          <button type="button" className={`free-now-owned-icon ${actions.owned ? 'is-owned' : ''}`} onClick={actions.onToggleOwned} aria-label={actions.owned ? `Remove ${game.title} from owned games` : `Mark ${game.title} as owned`} title={actions.owned ? 'Owned' : 'Mark as owned'}>✓</button>
          <button type="button" className="game-action" onClick={actions.onToggleWishlist}>{actions.wishlisted ? 'Wishlisted' : 'Add to wishlist'}</button>
        </div>
        <a
          href={game.open_giveaway_url}
          target="_blank"
          rel="noreferrer"
          className="lr-button free-now-card__cta"
        >
          Claim now <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  )
}

export default function FreeNow({ getGameActions, onAvailabilityChange, activeTab = 'claim', onTabChange }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [now, setNow] = useState(Date.now())
  const [showOwned, setShowOwned] = useState(false)
  const [comingGames, setComingGames] = useState([])
  const [alwaysGames, setAlwaysGames] = useState([])

  // update countdowns every minute
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { time, data } = JSON.parse(cached)
        if (Date.now() - time < CACHE_MS) {
          setGames(data)
          onAvailabilityChange(data)
          setLoading(false)
          return
        }
      }
    } catch {
      // ignore cache problems
    }

    try {
      let list = []
      try {
        const snapshotResponse = await fetch('/data/gamerpower-free-games.json')
        if (snapshotResponse.ok) {
          const snapshot = await snapshotResponse.json()
          if (Array.isArray(snapshot.games)) list = snapshot.games
        }
      } catch {
        // Fall through to the public API.
      }

      if (list.length === 0) {
        const res = await fetch(API)
        if (!res.ok) throw new Error('Server error')
        const data = await res.json()
        list = Array.isArray(data) ? data : []
      }
      setGames(list)
      onAvailabilityChange(list)
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ time: Date.now(), data: list })
        )
      } catch {
        // ignore cache problems
      }
    } catch {
      setError('Could not load free games. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    fetch('/data/epic-free-games.json').then((response) => response.ok ? response.json() : null).then((data) => setComingGames(Array.isArray(data?.upcoming) ? data.upcoming : [])).catch(() => {})
    fetch('/data/always-free-games.json').then((response) => response.ok ? response.json() : null).then((data) => setAlwaysGames(Array.isArray(data?.games) ? data.games : [])).catch(() => {})
  }, [])

  const currentGames = games.filter((game) => !/(android|ios|mobile)/i.test(game.platforms || ''))
  const shown = currentGames.filter((g) => g.platforms.toLowerCase().includes(filter))
  const claimGames = shown.filter((game) => showOwned || !getGameActions({ title: game.title, platform: game.platforms, image: game.thumbnail, source: 'free', sourceId: game.id }).owned)
  const tabTitle = activeTab === 'coming' ? 'Coming Soon' : activeTab === 'always' ? 'Always Free' : 'Free Now'
  const tabCount = activeTab === 'coming' ? comingGames.length : activeTab === 'always' ? alwaysGames.length : claimGames.length

  return (
    <section className="free-now-redesign">
      <header className="redesign-page-header">
        <div>
          <span className="lr-section-heading__kicker">LIMITED-TIME OFFERS</span>
          <h1>{tabTitle.split(' ')[0]} <strong>{tabTitle.split(' ').slice(1).join(' ')}</strong></h1>
        </div>
        <span className="redesign-result-count">{tabCount} games</span>
      </header>
        <div className="free-now-tabs" role="tablist" aria-label="Free games sections">
          {[['claim', 'Claim Now'], ['coming', 'Coming Soon'], ['always', 'Always Free']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-selected' : ''} onClick={() => onTabChange?.(id)}>{label}</button>)}
        </div>
        {activeTab === 'claim' && <>
        <div className="filter-toolbar free-now-filters" aria-label="Filter by platform">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.match)}
              aria-pressed={filter === f.match}
              className={`filter-chip ${filter === f.match ? 'is-selected' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="free-now-show-owned"><input type="checkbox" checked={showOwned} onChange={(event) => setShowOwned(event.target.checked)} /> Show owned games</label>

        {error && (
          <div className="inline-error" role="alert">
            {error}{' '}
            <button onClick={load} className="underline">
              Retry
            </button>
          </div>
        )}

        <div className="game-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : claimGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  now={now}
                  getGameActions={getGameActions}
                />
              ))}
        </div>

        {!loading && !error && claimGames.length === 0 && (
          <p className="empty-state">
            No free games found for this platform right now.
          </p>
        )}
        </>}
        {activeTab === 'coming' && <div className="game-grid">{comingGames.map((game) => <article className="lr-game-card coming-soon-card" key={game.id}>{game.image ? <img src={game.image} alt={game.title} loading="lazy" className="lr-game-card__image" /> : <div className="lr-art-fallback">COMING SOON</div>}<div className="lr-game-card__body"><span className="lr-badge lr-badge--lime">Epic confirmed</span><h2>{game.title}</h2><p className="game-platform">Starts {new Date(game.startDate).toLocaleString('en-IN')}</p></div></article>)}</div>}
        {activeTab === 'always' && <div className="game-grid">{alwaysGames.map((game) => <article className="lr-game-card always-free-card" key={game.id}>{game.thumbnail ? <img src={game.thumbnail} alt={game.title} loading="lazy" className="lr-game-card__image" /> : <div className="lr-art-fallback">ALWAYS FREE</div>}<div className="lr-game-card__body"><span className="lr-badge lr-badge--lime">Always Free</span><h2>{game.title}</h2><p className="game-platform">{game.platform} · {game.genre}</p></div></article>)}</div>}
    </section>
  )
}
