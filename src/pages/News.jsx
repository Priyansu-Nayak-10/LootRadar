import { useEffect, useState } from 'react'

function formatDate(value) {
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
  return `${Math.floor(hours / 24)}d ago`
}

function platformFromArticle(article) {
  if (Array.isArray(article.platforms)) {
    const platforms = article.platforms.join(' ').toLowerCase()
    if (platforms.includes('playstation') || platforms.includes('ps5') || platforms.includes('ps4')) return 'PS'
    if (platforms.includes('xbox')) return 'Xbox'
    if (platforms.includes('pc') || platforms.includes('steam') || platforms.includes('windows')) return 'PC'
  }
  const text = `${article.title} ${article.summary || ''}`.toLowerCase()
  if (text.includes('playstation') || text.includes('ps5') || text.includes('ps4')) return 'PS'
  if (text.includes('xbox') || text.includes('series x') || text.includes('series s')) return 'Xbox'
  if (text.includes('pc game') || text.includes('steam') || text.includes('pc port') || text.includes('pc version')) return 'PC'
  return 'All'
}

function NewsImage({ article }) {
  const [failed, setFailed] = useState(false)

  if (!article.image || failed) {
    return <div className="news-image-fallback" aria-hidden="true">RADAR</div>
  }

  return (
    <img
      src={article.image}
      alt=""
      loading="lazy"
      className="news-image"
      onError={() => setFailed(true)}
    />
  )
}

export default function News() {
  const [articles, setArticles] = useState([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/data/gaming-news.json')
      if (!response.ok) throw new Error('News snapshot unavailable')
      const data = await response.json()
      setGeneratedAt(data.generatedAt || '')
      setArticles(Array.isArray(data.articles) ? data.articles : [])
    } catch {
      setError('Gaming news could not load right now. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const featured = articles.slice(0, 5)
  const trending = articles.slice(5, 9)
  const filteredArticles = articles.filter((article) =>
    filter === 'All' ? true : platformFromArticle(article) === filter
  )

  return (
    <section className="news-page news-redesign">
      <header className="news-page-header">
        <div>
          <span className="lr-section-heading__kicker">Stay updated</span>
          <h1>Gaming <strong>News</strong></h1>
        </div>
        {generatedAt && <span>Updated {formatRelativeTime(generatedAt)}</span>}
      </header>
      {error && (
        <p className="discover-error" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={load}>Retry</button>
        </p>
      )}
      {loading ? (
        <div className="lr-skeleton news-feature-skeleton" />
      ) : (
        <>
          <div className="news-feature-grid">
            <div className="news-feature-carousel" aria-label="Featured gaming news">
              {featured.map((article, index) => (
                <article className="news-feature-slide" key={article.id || article.link}>
                  <NewsImage article={article} />
                  <div className="news-feature-overlay" />
                  <div className="news-feature-copy">
                    <span className="lr-badge lr-badge--lime">{index === 0 ? 'Trending' : article.source}</span>
                    <h2>{article.title}</h2>
                    {article.summary && <p>{article.summary}</p>}
                    <div>
                      <a href={article.link} target="_blank" rel="noreferrer" className="lr-button">Read Full Story</a>
                      <span>{formatRelativeTime(article.publishedAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="news-trending-side">
              <div className="lr-section-heading">
                <div className="lr-section-heading__copy">
                  <span className="lr-section-heading__kicker">MOST FOLLOWED</span>
                  <h2>Trending <strong>News</strong></h2>
                </div>
              </div>
              {trending.map((article) => (
                <article className="news-trending-item" key={article.id || article.link}>
                  <NewsImage article={article} />
                  <div>
                    <span>{article.source} · {formatRelativeTime(article.publishedAt)}</span>
                    <h3>{article.title}</h3>
                  </div>
                  <a href={article.link} target="_blank" rel="noreferrer" aria-label={`Read ${article.title}`} />
                </article>
              ))}
            </aside>
          </div>

          <section className="news-latest">
            <div className="lr-section-heading">
              <div className="lr-section-heading__copy">
                <span className="lr-section-heading__kicker">ALL HEADLINES</span>
                <h2>Latest <strong>News</strong></h2>
              </div>
            </div>
            <div className="news-filter-row" aria-label="Filter news by platform">
              {['All', 'PS', 'Xbox', 'PC'].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`lr-chip ${filter === option ? 'is-active' : ''}`}
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            {filteredArticles.length > 0 ? (
              <div className="news-latest-grid">
                {filteredArticles.map((article) => (
                  <article className="lr-news-card news-latest-card" key={article.id || article.link}>
                    <NewsImage article={article} />
                    <div className="lr-news-card__body">
                      <div className="news-card-meta">
                        <span className="lr-badge">{platformFromArticle(article)}</span>
                        <span>{article.source} · {formatRelativeTime(article.publishedAt)}</span>
                      </div>
                      <h3>{article.title}</h3>
                      {article.summary && <p>{article.summary}</p>}
                      <a href={article.link} target="_blank" rel="noreferrer" className="lr-button lr-button--ghost">
                        Read Story →
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="lr-empty">No stories match this platform.</div>
            )}
          </section>
        </>
      )}
      {!loading && !error && articles.length === 0 && (
        <p className="discover-empty">No recent stories are available right now.</p>
      )}
    </section>
  )
}
