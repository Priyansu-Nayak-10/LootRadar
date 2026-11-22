import { useEffect, useState } from 'react'
import { fetchGamingNews, fetchRawgGames, hasRawgKey } from '../lib/discoverApi'
import GameActions from '../components/GameActions'
import { lootRadarArt } from '../assets/art'

function dateString(date) {
  return date.toISOString().slice(0, 10)
}

function getDateRange(daysBack, daysAhead) {
  const today = new Date()
  const start = new Date(today)
  const end = new Date(today)
  start.setDate(start.getDate() - daysBack)
  end.setDate(end.getDate() + daysAhead)
  return `${dateString(start)},${dateString(end)}`
}

function formatDate(value) {
  if (!value || value === 'TBA') return 'Release date TBA'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Release date TBA'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatNewsDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatRelativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatCountdown(endDate) {
  if (!endDate) return 'Time TBA'
  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) return 'Time TBA'
  const diff = end.getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`
}

function GameTile({ game, badge, getGameActions }) {
  const platform = (game.platforms || [])
    .map((item) => item.platform?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')
  const actions = getGameActions({
    title: game.name,
    platform: platform || 'Multiple platforms',
    image: game.background_image,
    source: 'catalog',
    sourceId: game.id,
  })
  return (
    <article className="game-card discovery-game-card">
      <a
        className="discovery-art"
        href={`https://rawg.io/games/${game.slug}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${game.name} on RAWG`}
      >
          {game.background_image ? (
          <img src={game.background_image} alt="" loading="lazy" className="game-card-image" />
        ) : (
          <div className="game-card-image discovery-no-image">GAME</div>
        )}
        {badge && <span className="discovery-image-badge">{badge}</span>}
      </a>
      <div className="game-card-content discovery-card-content">
        <h3 className="game-title">{game.name}</h3>
        <p className="game-platform">
          {formatDate(game.released)}
          {platform && <span className="discovery-platforms"> · {platform}</span>}
          {Number(game.rating) > 0 && <span className="discovery-rating">★ {game.rating}</span>}
        </p>
        <div className="discovery-genres">
          {(game.genres || []).slice(0, 2).map((genre) => (
            <span key={genre.id || genre.name}>{genre.name}</span>
          ))}
        </div>
        <GameActions {...actions} />
        <a
          href={`https://rawg.io/games/${game.slug}`}
          target="_blank"
          rel="noreferrer"
          className="game-card-cta"
        >
          Game details <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
  )
}

function NewsTile({ article }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className={`news-card ${article.image ? '' : 'is-no-image'}`}>
      {article.image && !imageFailed ? (
        <img
          src={article.image}
          alt=""
          loading="lazy"
          className="news-image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="news-image-fallback" aria-hidden="true">RADAR</div>
      )}
      <div className="news-copy">
        <div className="news-meta">
          <span>{article.source || 'Gaming news'}</span>
          <span>{formatNewsDate(article.publishedAt)}</span>
        </div>
        <h3>{article.title}</h3>
        {article.summary && <p>{article.summary}</p>}
        <a href={article.link} target="_blank" rel="noreferrer" className="news-link">
          Read story <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
  )
}

function SetupHint() {
  return (
    <div className="api-setup-hint">
      <strong>Turn on game discovery</strong>
      <p>
        RAWG provides search, popularity, release dates, and game genres. Create a free personal API key,
        then add it to your local environment file.
      </p>
      <ol>
        <li>
          Get a key at <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer">rawg.io/apidocs</a>.
        </li>
        <li>Create <code>.env.local</code> in the project folder.</li>
        <li>Add <code>VITE_RAWG_API_KEY=your_key_here</code> and restart <code>npm run dev</code>.</li>
      </ol>
      <small>Free plan: up to 20,000 requests per month for personal projects; link back to RAWG where its data is shown.</small>
    </div>
  )
}

function decodeText(value) {
  if (!value || typeof document === 'undefined') return value || ''
  const textArea = document.createElement('textarea')
  textArea.innerHTML = value
  return textArea.value
}

function HomeRedesign({
  trending,
  catalogError,
  freeGames,
  upcomingGames,
  news,
  newsLoading,
  newsUpdatedAt,
  onNavigate,
  getGameActions,
  searchSubmitted,
  searchLoading,
  searchError,
  searchTerm,
  searchResults,
  hasKey,
}) {
  const [platformFilter, setPlatformFilter] = useState('All')
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)

  useEffect(() => {
    const carousel = document.getElementById('home-hero-carousel')
    const count = Math.min(trending.length, 5)
    if (!carousel || heroPaused || count < 2) return undefined
    const timer = window.setInterval(() => {
      setHeroIndex((current) => {
        const next = (current + 1) % count
        carousel.scrollTo({ left: next * carousel.clientWidth, behavior: 'smooth' })
        return next
      })
    }, 6000)
    return () => window.clearInterval(timer)
  }, [heroPaused, trending.length])

  function moveHero(direction) {
    const carousel = document.getElementById('home-hero-carousel')
    const count = Math.min(trending.length, 5)
    if (!carousel || !count) return
    const next = (heroIndex + direction + count) % count
    setHeroIndex(next)
    carousel.scrollTo({ left: next * carousel.clientWidth, behavior: 'smooth' })
  }

  const filteredPopular = trending.filter((game) => {
    if (platformFilter === 'All') return true
    const names = (game.platforms || []).map((item) => item.platform?.name || '')
    return names.some((name) => name.includes(platformFilter))
  })

  return (
    <div className="discover-page home-redesign">
      {!hasKey && <SetupHint />}

      {searchSubmitted && (
        <section className="discover-section home-search-results">
          <div className="lr-section-heading">
            <div className="lr-section-heading__copy">
              <span className="lr-section-heading__kicker">SEARCH RESULTS</span>
              <h2>Results for <strong>{searchTerm}</strong></h2>
            </div>
          </div>
          {searchLoading && <div className="lr-skeleton" />}
          {searchError && <p className="discover-error" role="alert">{searchError}</p>}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <p className="lr-empty">No games matched that search.</p>
          )}
          {searchResults.length > 0 && (
            <div className="game-grid discover-results">
              {searchResults.map((game) => (
                <GameTile key={game.id} game={game} getGameActions={getGameActions} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="home-feature-grid">
        <div className="home-hero-wrap">
          {catalogError && <p className="discover-error" role="alert">{catalogError}</p>}
          {trending.length > 0 ? (
            <>
              <div className="home-hero-carousel" id="home-hero-carousel" aria-label="Featured games">
                {trending.slice(0, 5).map((game, index) => (
                  <article className="home-hero-slide" key={game.id}>
                    {lootRadarArt.hero.src ? (
                      <img src={lootRadarArt.hero.src} alt={lootRadarArt.hero.alt} loading={index === 0 ? 'eager' : 'lazy'} />
                    ) : game.background_image ? (
                      <img src={game.background_image} alt={game.name} loading={index === 0 ? 'eager' : 'lazy'} />
                    ) : (
                      <div className="lr-art-fallback">LOOTRADAR</div>
                    )}
                    <div className="home-hero-overlay" />
                    <div className="home-hero-copy">
                      <span className="lr-badge lr-badge--lime">
                        {index === 0 ? 'Latest Release' : 'Trending on PC'}
                      </span>
                      <h1>{game.name}</h1>
                      <p>{formatDate(game.released)}{game.genres?.[0]?.name ? ` · ${game.genres[0].name}` : ''}</p>
                      <a href={`https://rawg.io/games/${game.slug}`} target="_blank" rel="noreferrer" className="lr-button">
                        Explore game
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              <div className="home-hero-controls">
                <span>{String(heroIndex + 1).padStart(2, '0')} / {String(Math.min(trending.length, 5)).padStart(2, '0')}</span>
                <button type="button" aria-label="Previous featured game" onClick={() => moveHero(-1)}>←</button>
                <button type="button" aria-label="Next featured game" onClick={() => moveHero(1)}>→</button>
              </div>
            </>
          ) : (
            <div className="lr-skeleton home-hero-skeleton" />
          )}
        </div>

        <aside className="home-feature-side">
          <section className="home-side-card">
            <div className="lr-section-heading">
              <div className="lr-section-heading__copy">
                <span className="lr-section-heading__kicker">LIMITED TIME</span>
                <h2>Free <strong>Games</strong></h2>
              </div>
              <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('free')}>View All</button>
            </div>
            {freeGames.length > 0 ? (
              <button type="button" className="home-feature-free" onClick={() => onNavigate('free')}>
                {freeGames[0].thumbnail ? <img src={freeGames[0].thumbnail} alt={freeGames[0].title} loading="lazy" /> : <div className="lr-art-fallback">FREE GAME</div>}
                <span><strong>{freeGames[0].title}</strong><small>{formatCountdown(freeGames[0].end_date)}</small></span>
              </button>
            ) : (
              <div className="lr-skeleton" />
            )}
          </section>

          <section className="home-side-card">
            <div className="lr-section-heading">
              <div className="lr-section-heading__copy">
                <span className="lr-section-heading__kicker">EPIC CONFIRMATIONS</span>
                <h2>Upcoming <strong>Releases</strong></h2>
              </div>
              <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('coming')}>View All</button>
            </div>
            <div className="home-upcoming-list">
              {upcomingGames.slice(0, 4).map((game) => (
                <button type="button" key={game.id} onClick={() => onNavigate('coming')}>
                  {game.image ? <img src={game.image} alt={game.title} loading="lazy" /> : <span className="home-upcoming-fallback">LR</span>}
                  <span><strong>{game.title}</strong><small>{formatDate(game.startDate?.slice(0, 10) || 'TBA')}</small></span>
                </button>
              ))}
              {upcomingGames.length === 0 && <div className="lr-skeleton" />}
            </div>
          </section>
        </aside>
      </section>

      <section className="discover-section home-popular">
        <div className="lr-section-heading">
          <div className="lr-section-heading__copy">
            <span className="lr-section-heading__kicker">DISCOVER</span>
            <h2>Popular <strong>Games</strong></h2>
          </div>
        </div>
        <div className="home-platform-chips" aria-label="Filter popular games by platform">
          {['All', 'PC', 'PlayStation', 'Xbox'].map((platform) => (
            <button type="button" key={platform} className={`lr-chip ${platformFilter === platform ? 'is-active' : ''}`} aria-pressed={platformFilter === platform} onClick={() => setPlatformFilter(platform)}>
              {platform}
            </button>
          ))}
        </div>
        {filteredPopular.length > 0 ? (
          <div className="lr-carousel home-popular-row" aria-label="Popular games">
            {filteredPopular.slice(0, 10).map((game) => {
              const actions = getGameActions({
                title: game.name,
                platform: (game.platforms || []).map((item) => item.platform?.name).filter(Boolean).join(', '),
                image: game.background_image,
                source: 'catalog',
                sourceId: game.id,
              })
              return (
                <article className="lr-game-card home-cover-card" key={game.id}>
                  {game.background_image ? <img src={game.background_image} alt={game.name} loading="lazy" decoding="async" className="lr-game-card__image" /> : <div className="lr-art-fallback">GAME</div>}
                  <button type="button" className={`home-heart ${actions.wishlisted ? 'is-active' : ''}`} aria-label={`${actions.wishlisted ? 'Remove' : 'Add'} ${game.name} ${actions.wishlisted ? 'from' : 'to'} wishlist`} onClick={actions.onToggleWishlist}>♥</button>
                  <div className="lr-game-card__body"><h3>{game.name}</h3><p>{formatDate(game.released)}</p></div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="lr-empty">No games match this platform.</div>
        )}
      </section>

      <section className="discover-section home-news-grid">
        <div className="lr-section-heading">
          <div className="lr-section-heading__copy">
            <span className="lr-section-heading__kicker">LATEST FROM THE INDUSTRY</span>
            <h2>Latest <strong>News</strong></h2>
          </div>
          <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('news')}>View All</button>
        </div>
        {newsLoading ? (
          <div className="lr-skeleton" />
        ) : news.length > 0 ? (
          <div className="home-news-layout">
            <article className="home-news-feature">
              {news[0].image ? <img src={news[0].image} alt="" loading="lazy" /> : <div className="lr-art-fallback">RADAR</div>}
              <div>
                <span>{news[0].source} · {formatRelativeTime(news[0].publishedAt)}</span>
                <h3>{decodeText(news[0].title)}</h3>
                <a href={news[0].link} target="_blank" rel="noreferrer" className="lr-button lr-button--ghost">Read Full Story</a>
              </div>
            </article>
            <div className="home-news-small">
              {news.slice(1, 3).map((article) => (
                <article key={article.id || article.link}>
                  {article.image ? <img src={article.image} alt="" loading="lazy" /> : <div className="lr-art-fallback">RADAR</div>}
                  <div><span>{article.source} · {formatRelativeTime(article.publishedAt)}</span><h3>{decodeText(article.title)}</h3></div>
                  <a href={article.link} target="_blank" rel="noreferrer" aria-label={`Read ${article.title}`} />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="lr-empty">No recent stories are available.</div>
        )}
      </section>

      <section className="home-bottom-grid">
        <div className="home-quick-access">
          <div className="lr-section-heading">
            <div className="lr-section-heading__copy">
              <span className="lr-section-heading__kicker">EXPLORE</span>
              <h2>Quick <strong>Access</strong></h2>
            </div>
          </div>
          <div className="home-quick-grid">
            <button type="button" onClick={() => onNavigate('free')}><span>01</span><strong>Free Games</strong></button>
            <button type="button" onClick={() => onNavigate('deals')}><span>02</span><strong>Deals</strong></button>
            <button type="button" onClick={() => onNavigate('coming')}><span>03</span><strong>Upcoming</strong></button>
            <button type="button" onClick={() => onNavigate('discover')}><span>04</span><strong>Top Charts</strong></button>
          </div>
        </div>
        <button type="button" className="home-promo-banner" onClick={() => onNavigate('account')}>
          {lootRadarArt.promo.src ? <img src={lootRadarArt.promo.src} alt={lootRadarArt.promo.alt} loading="lazy" /> : <span className="home-promo-radar" aria-hidden="true" />}
          <span><small>LOOTRADAR ALERTS</small><strong>Connect Telegram, never miss a free game</strong><em>Open Telegram settings →</em></span>
        </button>
      </section>
    </div>
  )
}

export default function Discover({ library, wishlist, getGameActions, onNavigate }) {
  const [trending, setTrending] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [news, setNews] = useState([])
  const [newsUpdatedAt, setNewsUpdatedAt] = useState('')
  const [newsError, setNewsError] = useState('')
  const [newsLoading, setNewsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [sectionCounts, setSectionCounts] = useState({
    free: 0,
    deals: 0,
    always: 0,
    coming: 0,
  })
  const [freeGames, setFreeGames] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])
  const [platformFilter, setPlatformFilter] = useState('All')
  const seedKey = [...wishlist, ...library]
    .map((game) => game.title?.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|')

  async function loadCatalog() {
    if (!hasRawgKey) return
    setCatalogError('')
    try {
      const [popularData] = await Promise.all([
        fetchRawgGames(
          { dates: getDateRange(365, 0), ordering: '-added', platforms: '4', page_size: '12' },
          'trending_pc'
        ),
      ])
      setTrending(Array.isArray(popularData.results) ? popularData.results : [])
    } catch {
      setCatalogError('Game discovery could not load. Check your connection and try again.')
    }
  }

  async function loadNews() {
    setNewsLoading(true)
    setNewsError('')
    try {
      const data = await fetchGamingNews()
      setNewsUpdatedAt(data.generatedAt || '')
      const stories = Array.isArray(data.articles) ? data.articles : []
      setNews(
        stories
          .filter((article) => !article.sponsored && article.title && article.link)
          .sort((first, second) => new Date(second.publishedAt) - new Date(first.publishedAt))
          .slice(0, 5)
      )
    } catch {
      setNewsError('Gaming news could not load right now. Please try again later.')
    } finally {
      setNewsLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [seedKey])

  useEffect(() => {
    loadNews()
  }, [])

  useEffect(() => {
    function handleShellSearch(event) {
      const query = event.detail?.query?.trim()
      if (!query) return
      setSearchTerm(query)
      searchGames(null, query)
    }
    window.addEventListener('lootradar-shell-search', handleShellSearch)
    return () => window.removeEventListener('lootradar-shell-search', handleShellSearch)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSectionCounts() {
      const requests = [
        ['free', '/data/gamerpower-free-games.json', 'games'],
        ['deals', '/data/cheapshark-deals.json', 'deals'],
        ['always', '/data/always-free-games.json', 'games'],
        ['coming', '/data/epic-free-games.json', 'upcoming'],
      ]

      const counts = {}
      let gamerPowerGames = []
      let epicUpcoming = []
      await Promise.all(requests.map(async ([key, url, field]) => {
        try {
          const response = await fetch(url)
          if (!response.ok) return
          const data = await response.json()
          counts[key] = Array.isArray(data[field]) ? data[field].length : 0
          if (key === 'free') gamerPowerGames = Array.isArray(data.games) ? data.games : []
          if (key === 'coming') epicUpcoming = Array.isArray(data.upcoming) ? data.upcoming : []
        } catch {
          counts[key] = 0
        }
      }))

      if (!cancelled) {
        setSectionCounts((current) => ({ ...current, ...counts }))
        setFreeGames(gamerPowerGames)
        setUpcomingGames(epicUpcoming)
      }
    }

    loadSectionCounts()
    return () => {
      cancelled = true
    }
  }, [])

  async function searchGames(event, externalQuery) {
    if (event?.preventDefault) event.preventDefault()
    const query = (externalQuery || searchTerm).trim()
    if (!query) return

    setSearchSubmitted(true)
    setSearchLoading(true)
    setSearchError('')
    try {
      const data = await fetchRawgGames(
        { search: query, page_size: '8' },
        `search_${query.toLowerCase()}`
      )
      setSearchResults(Array.isArray(data.results) ? data.results : [])
    } catch (error) {
      setSearchError(error.message.startsWith('Add your free RAWG')
        ? error.message
        : 'Search could not load. Check your connection and try again.')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  return (
    <HomeRedesign
      trending={trending}
      catalogError={catalogError}
      freeGames={freeGames}
      upcomingGames={upcomingGames}
      news={news}
      newsLoading={newsLoading}
      newsUpdatedAt={newsUpdatedAt}
      onNavigate={onNavigate}
      getGameActions={getGameActions}
      searchSubmitted={searchSubmitted}
      searchLoading={searchLoading}
      searchError={searchError}
      searchTerm={searchTerm}
      searchResults={searchResults}
      hasKey={hasRawgKey}
    />
  )

  return (
    <div className="discover-page">
      {!hasRawgKey && <SetupHint />}

      <section className="discover-section search-section">
        <div className="discover-section-heading">
          <div>
            <span className="discover-kicker">FIND YOUR NEXT FAVORITE</span>
            <h2>Search games</h2>
          </div>
          <span className="discover-heading-note">Search a catalog of 500,000+ games</span>
        </div>
        <form className="discover-search" onSubmit={searchGames}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" strokeLinecap="round" />
          </svg>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by game title..."
            aria-label="Search games by title"
          />
          <button type="submit" disabled={searchLoading}>
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {searchError && <p className="discover-error" role="alert">{searchError}</p>}
        {searchSubmitted && !searchLoading && !searchError && searchResults.length === 0 && (
          <p className="discover-empty">No games matched that search. Try another title.</p>
        )}
        {searchResults.length > 0 && (
          <div className="game-grid discover-results">
            {searchResults.map((game) => <GameTile key={game.id} game={game} getGameActions={getGameActions} />)}
          </div>
        )}
      </section>

      <section className="discover-section">
        <div className="discover-section-heading">
          <div>
            <span className="discover-kicker">THE PC RADAR</span>
            <h2>Trending on PC</h2>
          </div>
          <span className="discover-heading-note">Top 5 from RAWG</span>
        </div>
        {catalogError && <p className="discover-error" role="alert">{catalogError}</p>}
        {trending.length > 0 ? (
          <div className="trending-carousel">
            {trending.slice(0, 5).map((game, index) => (
              <div className="trending-slide" key={game.id}>
                <GameTile game={game} badge={`0${index + 1}`} getGameActions={getGameActions} />
              </div>
            ))}
          </div>
        ) : (
          <p className="discover-empty">
            {hasRawgKey ? 'Trending games will appear here when the catalog loads.' : 'Add your RAWG key to load global trends.'}
          </p>
        )}
      </section>

      <section className="discover-section">
        <div className="discover-section-heading">
          <div>
            <span className="discover-kicker">EXPLORE LOOTRADAR</span>
            <h2>Section radar</h2>
          </div>
          <span className="discover-heading-note">Jump to a full page</span>
        </div>
        <div className="home-section-strips">
          <button type="button" className="home-section-strip" onClick={() => onNavigate('free')}>
            <span>FREE NOW</span>
            <strong>{sectionCounts.free}</strong>
            <small>Limited-time giveaways</small>
          </button>
          <button type="button" className="home-section-strip" onClick={() => onNavigate('deals')}>
            <span>DEALS</span>
            <strong>{sectionCounts.deals}</strong>
            <small>PC deals under $15</small>
          </button>
          <button type="button" className="home-section-strip" onClick={() => onNavigate('always')}>
            <span>ALWAYS FREE</span>
            <strong>{sectionCounts.always}</strong>
            <small>Free-to-play games</small>
          </button>
          <button type="button" className="home-section-strip" onClick={() => onNavigate('coming')}>
            <span>COMING SOON</span>
            <strong>{sectionCounts.coming}</strong>
            <small>Confirmed Epic offers</small>
          </button>
        </div>
      </section>

      <section className="discover-section news-section">
        <div className="discover-section-heading">
          <div>
            <span className="discover-kicker">LATEST FROM THE INDUSTRY</span>
            <h2>Gaming news</h2>
          </div>
          <a href="/data/gaming-news.json" target="_blank" rel="noreferrer" className="discover-heading-link">
            {newsUpdatedAt ? `Feed updated ${formatNewsDate(newsUpdatedAt)}` : 'Gaming headlines'} <span aria-hidden="true">-&gt;</span>
          </a>
        </div>
        {newsError && <p className="discover-error" role="alert">{newsError}</p>}
        {newsLoading && news.length === 0 ? (
          <div className="news-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="news-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="news-grid">
            {news.map((article) => (
              <NewsTile
                key={article.id || article.link}
                article={{ ...article, title: decodeText(article.title), summary: decodeText(article.summary) }}
              />
            ))}
          </div>
        ) : (
          <p className="discover-empty">
            {newsLoading ? 'Loading recent stories...' : 'No recent stories are available right now.'}
            {!newsLoading && <button type="button" onClick={loadNews}>Retry</button>}
          </p>
        )}
        <p className="discover-source-note">
          News headlines and summaries from IGN, PC Gamer, and GameSpot RSS feeds; stories open at their original publishers.
        </p>
      </section>
    </div>
  )
}
