import { useEffect, useState } from 'react'

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
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

  return (
    <section className="news-page">
      <div className="discover-section-heading">
        <div>
          <span className="discover-kicker">LATEST FROM THE INDUSTRY</span>
          <h2>Gaming News</h2>
        </div>
        {generatedAt && <span className="discover-heading-note">Updated {formatDate(generatedAt)}</span>}
      </div>
      {error && (
        <p className="discover-error" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={load}>Retry</button>
        </p>
      )}
      {loading ? (
        <div className="news-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="news-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <div className="news-grid news-page-grid">
          {articles.map((article) => (
            <article className="news-card" key={article.id || article.link}>
              <NewsImage article={article} />
              <div className="news-copy">
                <div className="news-meta">
                  <span>{article.source || 'Gaming news'}</span>
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
                <h3>{article.title}</h3>
                {article.summary && <p>{article.summary}</p>}
                <a href={article.link} target="_blank" rel="noreferrer" className="news-link">
                  Read story <span aria-hidden="true">-&gt;</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && articles.length === 0 && (
        <p className="discover-empty">No recent stories are available right now.</p>
      )}
    </section>
  )
}
