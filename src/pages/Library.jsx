import { useState, useMemo } from 'react'
import SafeImage from '../components/SafeImage'
import {
  SearchIcon,
  LibraryIcon,
  CheckIcon,
  ExternalLinkIcon,
  TrashIcon,
  ChevronDownIcon,
} from '../components/icons'

function formatLibrarySource(source) {
  if (!source) return 'Added manually'
  if (source === 'deal') return 'Claimed from a deal'
  if (source === 'gamerpower') return 'Claimed free giveaway'
  return source
}

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

export default function Library({ games = [], syncing = false, onAdd, onRemove, onNavigate }) {
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
    if (sortBy === 'recent') {
      list.sort((a, b) => {
        const aTime = a?.addedAt ? (typeof a.addedAt === 'number' ? a.addedAt : new Date(a.addedAt).getTime()) : -1
        const bTime = b?.addedAt ? (typeof b.addedAt === 'number' ? b.addedAt : new Date(b.addedAt).getTime()) : -1
        const validA = Number.isFinite(aTime) ? aTime : -1
        const validB = Number.isFinite(bTime) ? bTime : -1
        if (validA === -1 && validB === -1) return 0
        if (validA === -1) return 1
        if (validB === -1) return -1
        return validB - validA
      })
    } else if (sortBy === 'az') {
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
          <div>
            <p className="wr-eyebrow">Your collection</p>
            <h1 className="wr-heading">
              My <em>Library</em>
            </h1>
          </div>
          <span className="wr-count-pill">
            {games.length} {games.length === 1 ? 'game' : 'games'} owned
          </span>
        </div>
      </header>

      {games.length > 0 && (
        <div className="library-toolbar">
          <label className="wr-input library-search">
            <SearchIcon size={16} strokeWidth={2} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search owned games"
            />
          </label>

          <div className="library-filters" aria-label="Filter by platform">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                className={`wr-chip ${activePlatform === platform ? 'is-active' : ''}`}
                onClick={() => setActivePlatform(platform)}
                aria-pressed={activePlatform === platform}
              >
                {platform}
              </button>
            ))}
          </div>

          <div className="library-sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="wr-chip library-sort-select"
              aria-label="Sort library"
            >
              <option value="recent">Recently Added</option>
              <option value="az">Title A-Z</option>
              <option value="za">Title Z-A</option>
            </select>
            <ChevronDownIcon size={16} className="library-sort-chevron" />
          </div>
        </div>
      )}

      {games.length === 0 && syncing ? (
        <div className="list-sync-state" role="status" aria-busy="true">
          <div className="lr-skeleton list-sync-state__bar" />
          <p className="list-sync-state__label">Syncing your lists…</p>
        </div>
      ) : games.length === 0 ? (
        <div className="library-empty">
          <div className="library-empty__icon" aria-hidden="true">
            <LibraryIcon size={28} strokeWidth={1.75} />
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
                        aria-label={`Add ${item.title} to library`}
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
              </div>

              <div className="library-card__tags">
                <span className="wr-badge wr-badge--accent">Owned</span>
                {game.platform && (
                  <span className="wr-store-chip library-card__platform-chip">
                    {game.platform}
                  </span>
                )}
              </div>

              <div className="library-card__body">
                <h2 className="wr-title" title={game.title}>
                  {game.title}
                </h2>
                <div className="library-card__meta">
                  <CheckIcon size={14} />
                  <span>{formatLibrarySource(game.source)}</span>
                </div>
                <div className="library-card__actions">
                  {game.sourceId && (
                    <a
                      href={
                        game.source === 'deal'
                          ? (game.url || '#')
                          : game.source === 'gamerpower'
                          ? `https://www.gamerpower.com/open/${game.sourceId}`
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wr-cta wr-cta--secondary library-card__store-btn"
                    >
                      Store page <ExternalLinkIcon size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="wr-icon-btn wr-icon-btn--danger library-card__remove-btn"
                    onClick={() => onRemove?.(game.title)}
                    aria-label={`Remove ${game.title} from library`}
                    title="Remove from library"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
