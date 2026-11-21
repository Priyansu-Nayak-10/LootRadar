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
  return (
    <article className={`news-card ${article.image ? '' : 'is-no-image'}`}>
      {article.image ? (
        <img src={article.image} alt="" loading="lazy" className="news-image" />
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

export default function Discover({ library, wishlist, getGameActions }) {
  const [trending, setTrending] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [isPersonalized, setIsPersonalized] = useState(false)
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
  const seedKey = [...wishlist, ...library]
    .map((game) => game.title?.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|')

  async function loadCatalog() {
    if (!hasRawgKey) return
    setCatalogError('')
    try {
      const [popularData, upcomingData] = await Promise.all([
        fetchRawgGames(
          { dates: getDateRange(365, 0), ordering: '-added', page_size: '12' },
          'trending_global'
        ),
        loadUpcomingGames(),
      ])
      setTrending(Array.isArray(popularData.results) ? popularData.results : [])
      setUpcoming(upcomingData.games)
      setIsPersonalized(upcomingData.personalized)
    } catch {
      setCatalogError('Game discovery could not load. Check your connection and try again.')
    }
  }

  async function loadUpcomingGames() {
    const seeds = [...wishlist, ...library]
      .map((game) => game.title?.trim())
      .filter(Boolean)
      .filter((title, index, list) => list.findIndex((item) => item.toLowerCase() === title.toLowerCase()) === index)
      .slice(0, 3)

    let genreIds = []
    if (seeds.length > 0) {
      const genreResults = await Promise.all(
        seeds.map((title) =>
          fetchRawgGames({ search: title, page_size: '3' }, `seed_${title.toLowerCase()}`)
        )
      )
      const counts = new Map()
      for (const result of genreResults) {
        const games = Array.isArray(result.results) ? result.results : []
        for (const genre of games[0]?.genres || []) {
          counts.set(genre.id, (counts.get(genre.id) || 0) + 1)
        }
      }
      genreIds = [...counts.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, 3)
        .map(([id]) => id)
    }

    const parameters = {
      dates: getDateRange(30, 365),
      ordering: '-added',
      page_size: '12',
    }
    if (genreIds.length > 0) parameters.genres = genreIds.join(',')

    const data = await fetchRawgGames(parameters, `upcoming_${genreIds.join('_') || 'all'}`)
    return {
      games: Array.isArray(data.results) ? data.results : [],
      personalized: genreIds.length > 0,
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
          .slice(0, 6)
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

  async function searchGames(event) {
    event.preventDefault()
    const query = searchTerm.trim()
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

  const personalizedHeading = isPersonalized ? 'Picked from your games' : 'New & upcoming games'

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
            <span className="discover-kicker">THE GLOBAL RADAR</span>
            <h2>Trending games globally</h2>
          </div>
          <span className="discover-heading-note">Popular worldwide on RAWG</span>
        </div>
        {catalogError && <p className="discover-error" role="alert">{catalogError}</p>}
        {trending.length > 0 ? (
          <div className="trending-carousel">
            {trending.map((game, index) => (
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
            <span className="discover-kicker">NEXT UP FOR YOU</span>
            <h2>{personalizedHeading}</h2>
          </div>
          {isPersonalized && <span className="personalized-mark">Based on your Library & Wishlist</span>}
        </div>
        {upcoming.length > 0 ? (
          <div className="game-grid">
            {upcoming.map((game) => (
              <GameTile key={game.id} game={game} badge="UP NEXT" getGameActions={getGameActions} />
            ))}
          </div>
        ) : (
          <p className="discover-empty">
            {hasRawgKey
              ? 'Upcoming releases will appear here when the catalog loads.'
              : 'Add games to your Library or Wishlist to personalize upcoming picks.'}
          </p>
        )}
        <p className="discover-source-note">
          Recommendations use the genres associated with games in your Library and Wishlist. Release dates come from RAWG.
        </p>
      </section>

      <section className="discover-section news-section">
        <div className="discover-section-heading">
          <div>
            <span className="discover-kicker">LATEST FROM THE INDUSTRY</span>
            <h2>Gaming news</h2>
          </div>
          <a href="https://gamebeeper.gg" target="_blank" rel="noreferrer" className="discover-heading-link">
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
          News headlines and summaries from <a href="https://gamebeeper.gg" target="_blank" rel="noreferrer">GameBeeper</a>; stories open at their original publishers.
        </p>
      </section>
    </div>
  )
}
