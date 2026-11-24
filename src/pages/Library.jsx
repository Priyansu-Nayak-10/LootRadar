import { useState, useMemo } from 'react'
import SafeImage from '../components/SafeImage'

const PLATFORMS = ['All', 'PC', 'Steam', 'Epic Games', 'GOG', 'PlayStation', 'Xbox']

const POPULAR_STARTER_GAMES = [
  {
    title: 'Cyberpunk 2077',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
    platform: 'PC / Steam',
    genre: 'RPG / Open World',
  },
  {
    title: 'The Witcher 3: Wild Hunt',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg',
    platform: 'PC / Steam',
    genre: 'RPG / Action',
  },
  {
    title: 'Grand Theft Auto V',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg',
    platform: 'PC / Steam',
    genre: 'Action / Adventure',
  },
  {
    title: 'Elden Ring',
    image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg',
    platform: 'PC / Steam',
    genre: 'Action RPG',
  },
]

export default function Library({ games = [], onAdd, onRemove, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activePlatform, setActivePlatform] = useState('All')
  const [sortBy, setSortBy] = useState('recent') // 'recent' | 'az' | 'za'

  const filteredGames = useMemo(() => {
    let list = Array.isArray(games) ? [...games] : []

    // 1. Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      list = list.filter((g) => (g.title || '').toLowerCase().includes(q))
    }

    // 2. Platform filter
    if (activePlatform !== 'All') {
      const target = activePlatform.toLowerCase()
      list = list.filter((g) => {
        const plat = (g.platform || '').toLowerCase()
        if (target === 'pc') return plat.includes('pc') || plat.includes('windows')
        if (target === 'steam') return plat.includes('steam')
        if (target === 'epic games') return plat.includes('epic')
        if (target === 'gog') return plat.includes('gog')
        if (target === 'playstation') return plat.includes('ps') || plat.includes('playstation')
        if (target === 'xbox') return plat.includes('xbox')
        return plat.includes(target)
      })
    }

    // 3. Sorting
    if (sortBy === 'az') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else if (sortBy === 'za') {
      list.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
    }

    return list
  }, [games, searchTerm, activePlatform, sortBy])

  return (
    <div className="library-page collections-redesign">
      <header className="library-header">
        <div className="library-header__top">
          <div className="lr-section-heading__copy">
            <span className="lr-section-heading__kicker">YOUR COLLECTION</span>
            <h1>
              My <strong>Library</strong>
            </h1>
          </div>
          <span className="library-header__count">
            {games.length} {games.length === 1 ? 'game' : 'games'} owned
          </span>
        </div>
      </header>

      {games.length > 0 && (
        <div className="library-toolbar">
          <div className="library-search">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search owned games"
            />
          </div>

          <div className="library-filters" role="tablist" aria-label="Filter by platform">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                className={`library-filter-chip ${activePlatform === platform ? 'is-active' : ''}`}
                onClick={() => setActivePlatform(platform)}
                role="tab"
                aria-selected={activePlatform === platform}
              >
                {platform}
              </button>
            ))}
          </div>

          <div className="library-sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
              aria-label="Sort library"
            >
              <option value="recent">Recently Added</option>
              <option value="az">Title A-Z</option>
              <option value="za">Title Z-A</option>
            </select>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <div className="library-empty">
          <div className="library-empty__icon" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h2>Your library is empty</h2>
          <p>
            Keep track of all your claimed giveaways and purchased games in one place. Mark games as
            owned to build your personal gaming library.
          </p>
          <div className="library-empty__actions">
            <button
              type="button"
              className="lr-button"
              onClick={() => onNavigate?.('free')}
            >
              Browse Free Games
            </button>
            <button
              type="button"
              className="lr-button lr-button--secondary"
              onClick={() => onNavigate?.('deals')}
            >
              Browse Deals
            </button>
          </div>

          <div className="empty-suggestions-shelf">
            <div className="empty-suggestions-header">
              <span className="empty-suggestions-kicker">COMMONLY CLAIMED</span>
              <h3 className="empty-suggestions-title">Add Popular Titles to Library</h3>
            </div>
            <div className="empty-suggestions-grid">
              {POPULAR_STARTER_GAMES.map((item) => {
                const isOwned = games.some(
                  (g) => (g.title || '').trim().toLowerCase() === item.title.trim().toLowerCase()
                )
                return (
                  <article key={item.title} className="empty-suggestion-card">
                    <div className="empty-suggestion-card__media">
                      <SafeImage src={item.image} alt={item.title} fallbackText={item.title} />
                    </div>
                    <div className="empty-suggestion-card__body">
                      <h4 className="empty-suggestion-card__title" title={item.title}>
                        {item.title}
                      </h4>
                      <span className="empty-suggestion-card__meta">{item.platform}</span>
                      <button
                        type="button"
                        className={`empty-suggestion-card__btn ${isOwned ? 'is-added' : ''}`}
                        onClick={() => !isOwned && onAdd?.(item)}
                        disabled={isOwned}
                      >
                        {isOwned ? '✓ In Library' : '+ Add to Library'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="library-empty">
          <h2>No matching games</h2>
          <p>No games in your library match the current search or platform filter.</p>
          <button
            type="button"
            className="lr-button lr-button--ghost"
            onClick={() => {
              setSearchTerm('')
              setActivePlatform('All')
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="library-grid">
          {filteredGames.map((game) => (
            <article className="library-card" key={game.title}>
              <div className="library-card__media">
                <SafeImage
                  src={game.image}
                  alt={game.title}
                  fallbackText={game.title}
                />
                <span className="library-card__badge-owned">Owned</span>
                {game.platform && (
                  <span className="library-card__platform">{game.platform}</span>
                )}
              </div>
              <div className="library-card__body">
                <h2 className="library-card__title" title={game.title}>
                  {game.title}
                </h2>
                <div className="library-card__meta">
                  <span>{game.source || 'Claimed Game'}</span>
                </div>
                <div className="library-card__actions">
                  <button
                    type="button"
                    className="library-card__remove"
                    onClick={() => onRemove?.(game.title)}
                    title="Remove from library"
                  >
                    Remove
                  </button>
                  {game.sourceId && (
                    <a
                      href={
                        game.source === 'deal'
                          ? `https://www.cheapshark.com/redirect?dealID=${game.sourceId}`
                          : game.source === 'gamerpower'
                          ? `https://www.gamerpower.com/open/${game.sourceId}`
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lr-button lr-button--ghost"
                      style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                    >
                      Store page →
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
