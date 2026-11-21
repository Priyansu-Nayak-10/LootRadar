import { useEffect, useState } from 'react'
import { fetchGamingNews, fetchRawgGames, hasRawgKey } from '../lib/discoverApi'
import GameActions from '../components/GameActions'

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
      await Promise.all(requests.map(async ([key, url, field]) => {
        try {
          const response = await fetch(url)
          if (!response.ok) return
          const data = await response.json()
          counts[key] = Array.isArray(data[field]) ? data[field].length : 0
        } catch {
          counts[key] = 0
        }
      }))

      if (!cancelled) setSectionCounts((current) => ({ ...current, ...counts }))
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
