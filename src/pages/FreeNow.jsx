import { useEffect, useState } from 'react'
import GameActions from '../components/GameActions'

const API = 'https://www.gamerpower.com/api/giveaways?type=game'
const CACHE_KEY = 'lootradar_free'
const CACHE_MS = 10 * 60 * 1000

const FILTERS = [
  { label: 'All', match: '' },
  { label: 'Epic', match: 'epic' },
  { label: 'Steam', match: 'steam' },
  { label: 'GOG', match: 'gog' },
  { label: 'itch.io', match: 'itch' },
  { label: 'PlayStation', match: 'playstation' },
  { label: 'Xbox', match: 'xbox' },
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
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-image" />
      <div className="skeleton-lines">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
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
    <article className="game-card">
      <img
        src={game.thumbnail}
        alt={game.title}
        loading="lazy"
        className="game-card-image"
      />
      <div className="game-card-content">
        <h2 className="game-title">{game.title}</h2>
        <p className="game-platform">{game.platforms}</p>
        <div className="game-price-row">
          {game.worth && game.worth !== 'N/A' && (
            <span className="old-price">
              {game.worth} USD
            </span>
          )}
          <span className="game-status-pill">FREE</span>
          {left && (
            <span className={`countdown-pill ${left.urgent ? 'is-urgent' : ''}`}>
              {left.text}
            </span>
          )}
        </div>
        <GameActions {...actions} />
        <a
          href={game.open_giveaway_url}
          target="_blank"
          rel="noreferrer"
          className="game-card-cta"
        >
          Claim now <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
  )
}

export default function FreeNow({ getGameActions, onAvailabilityChange }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [now, setNow] = useState(Date.now())

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

  const shown = games.filter((g) =>
    g.platforms.toLowerCase().includes(filter)
  )

  return (
    <section>
        <div className="filter-toolbar" aria-label="Filter by platform">
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
            : shown.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  now={now}
                  getGameActions={getGameActions}
                />
              ))}
        </div>

        {!loading && !error && shown.length === 0 && (
          <p className="empty-state">
            No free games found for this platform right now.
          </p>
        )}
    </section>
  )
}
