import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRawgGames } from '../lib/discoverApi'
import GameCard, { normalizeTitle } from './GameCard'

const PLATFORM_FILTERS = {
  All: undefined,
  PC: '1',
  PlayStation: '2',
  Xbox: '3',
}

const CACHE_MS = 10 * 60 * 1000

function popularDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  return `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`
}

function getSessionCache(key) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null')
    return cached && Date.now() - cached.time < CACHE_MS ? cached.data : null
  } catch {
    return null
  }
}

function setSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data }))
  } catch {
    // The section still works if session storage is unavailable.
  }
}

export default function PopularGames({ getGameActions, hasRawgKey }) {
  const [filter, setFilter] = useState('All')
  const [games, setGames] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const rowRef = useRef(null)

  const dealsByTitle = useMemo(() => new Map(
    deals.map((deal) => [normalizeTitle(deal.title), deal])
  ), [deals])

  useEffect(() => {
    let cancelled = false
    fetch('/data/cheapshark-deals.json')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled) setDeals(Array.isArray(data?.deals) ? data.deals : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hasRawgKey) {
      setLoading(false)
      setError('Add a RAWG key to load popular games.')
      return undefined
    }
    let cancelled = false
    const cacheKey = `lootradar_popular_${filter.toLowerCase()}`
    const cached = getSessionCache(cacheKey)
    if (cached) {
      setGames(cached)
      setLoading(false)
      setError('')
      return undefined
    }

    setLoading(true)
    setError('')
    const parameters = { ordering: '-added', dates: popularDateRange(), page_size: '10' }
    if (PLATFORM_FILTERS[filter]) parameters.parent_platforms = PLATFORM_FILTERS[filter]
    fetchRawgGames(parameters, `popular_${filter.toLowerCase()}`, CACHE_MS)
      .then((data) => {
        const results = Array.isArray(data.results) ? data.results : []
        if (!cancelled) {
          setSessionCache(cacheKey, results)
          setGames(results)
        }
      })
      .catch(() => { if (!cancelled) setError('Popular games could not load. Please try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [filter, hasRawgKey])

  function scrollRow(direction) {
    const row = rowRef.current
    if (!row) return
    const firstCard = row.querySelector('.popular-game-card')
    const distance = firstCard ? firstCard.getBoundingClientRect().width + 12 : 240
    row.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  return (
    <section className="popular-games-section" aria-labelledby="popular-games-heading">
      <header className="popular-games-section__header">
        <div>
          <span className="popular-games-section__kicker">DISCOVER</span>
          <h2 id="popular-games-heading">Popular <strong>Games</strong></h2>
          <p>Most added to collections in the past year</p>
        </div>
        <div className="popular-games-section__controls">
          <div className="popular-games-section__chips" aria-label="Filter popular games by platform">
            {Object.keys(PLATFORM_FILTERS).map((item) => (
              <button key={item} type="button" className={filter === item ? 'is-active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <button type="button" className="popular-games-section__arrow" aria-label="Scroll popular games left" onClick={() => scrollRow(-1)}>‹</button>
          <button type="button" className="popular-games-section__arrow" aria-label="Scroll popular games right" onClick={() => scrollRow(1)}>›</button>
        </div>
      </header>
      {loading ? (
        <div className="popular-games-section__row popular-games-section__skeletons" aria-label="Loading popular games">
          {Array.from({ length: 5 }).map((_, index) => <div className="popular-games-section__skeleton" key={index} />)}
        </div>
      ) : error ? (
        <p className="popular-games-section__message" role="status">{error}</p>
      ) : games.length === 0 ? (
        <p className="popular-games-section__message">No popular games match this platform.</p>
      ) : (
        <div className="popular-games-section__row" ref={rowRef}>
          {games.map((game, index) => {
            const platform = (game.platforms || []).map((item) => item.platform?.name).filter(Boolean).join(', ')
            const actions = getGameActions({ title: game.name, platform, image: game.background_image, source: 'catalog', sourceId: game.id })
            const isPc = (game.platforms || []).some((item) => item.platform?.name === 'PC')
            return <GameCard key={game.id} game={game} rank={index + 1} deal={isPc ? dealsByTitle.get(normalizeTitle(game.name)) : null} actions={actions} />
          })}
        </div>
      )}
    </section>
  )
}
