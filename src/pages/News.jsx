import { useCallback, useEffect, useState } from 'react'
import SafeImage from '../components/SafeImage'
import NewsPlatformBadges from '../components/NewsPlatformBadges'
import {
  cleanNewsText,
  fetchNewsSnapshot,
  formatNewsRelativeTime,
  getSnapshotAgeHours,
} from '../lib/newsHelpers'

function NewsTags({ article }) {
  const isTrending = (article?.coverageCount || 0) >= 3
  const isStale = Boolean(article?.stale)
  if (!isTrending && !isStale) return null
  return (
    <span className="news-tags-group">
      {isTrending && <span className="lr-badge lr-badge--lime">Trending</span>}
      {isStale && <span className="news-stale-tag">Older story</span>}
    </span>
  )
}

function NewsSkeleton() {
  return (
    <div className="news-skeleton-layout" aria-busy="true" aria-label="Loading gaming news">
      <div className="news-feature-grid">
        <div className="lr-skeleton news-feature-skeleton" />
        <div className="news-trending-side">
          <div className="lr-skeleton news-trending-heading-skeleton" />
          {[0, 1, 2, 3].map((idx) => (
            <div className="lr-skeleton news-trending-item-skeleton" key={idx} />
          ))}
        </div>
      </div>
      <div className="news-bottom-grid">
        {[0, 1, 2, 3, 4].map((idx) => (
          <div className="lr-skeleton news-card-skeleton" key={idx} />
        ))}
      </div>
    </div>
  )
}

export default function News() {
  const [articles, setArticles] = useState([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchNewsSnapshot({ forceRefresh })
      setGeneratedAt(data.generatedAt || '')
      setArticles(data.articles)
    } catch {
      setError('Gaming news could not load right now. Please try again.')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  const ageHours = getSnapshotAgeHours(generatedAt)
  const isVeryStale = Boolean(generatedAt) && ageHours > 12
  const isDelayed = Boolean(generatedAt) && ageHours > 2 && ageHours <= 12

  const featured = articles[0] || null
  const trending = articles.slice(1, 5)
  const rest = articles.slice(5, 15)

  return (
    <section className="news-page news-redesign">
      <header className="news-page-header">
        <div>
          <span className="lr-section-heading__kicker">LATEST FROM THE INDUSTRY</span>
          <h1>Gaming <strong>News</strong></h1>
        </div>
        <div className="news-freshness">
          {generatedAt && <span>Updated {formatNewsRelativeTime(generatedAt)}</span>}
          {isDelayed && <span className="news-delay-note">News may be delayed</span>}
          {isVeryStale && (
            <span className="news-stale-alert">
              Snapshot is over 12h old
              <button
                type="button"
                className="lr-button lr-button--ghost news-reload-btn"
                onClick={() => load(true)}
              >
                Reload
              </button>
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <NewsSkeleton />
      ) : error || !featured ? (
        <div className="news-error-box" role="alert">
          <p>{error || 'Gaming news is currently unavailable.'}</p>
          <button type="button" className="lr-button" onClick={() => load(true)}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="news-feature-grid">
            <article className="news-feature-hero">
              <SafeImage
                src={featured.image}
                alt={cleanNewsText(featured.title)}
                loading="eager"
                className="news-image"
                fallbackText="RADAR"
              />
              <div className="news-feature-overlay" />
              <div className="news-feature-copy">
                <div className="news-feature-badges">
                  <span className="lr-badge">{featured.source}</span>
                  <NewsTags article={featured} />
                  <NewsPlatformBadges platforms={featured.platforms} />
                </div>
                <h2>{cleanNewsText(featured.title)}</h2>
                {featured.summary && (
                  <p className="news-feature-summary">{cleanNewsText(featured.summary)}</p>
                )}
                <div className="news-feature-actions">
                  <a
                    href={featured.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lr-button"
                  >
                    Read story
                  </a>
                  <span>{formatNewsRelativeTime(featured.publishedAt)}</span>
                </div>
              </div>
            </article>

            <aside className="news-trending-side" aria-label="Trending news">
              <div className="lr-section-heading">
                <div className="lr-section-heading__copy">
                  <span className="lr-section-heading__kicker">WIDELY COVERED</span>
                  <h2>Trending</h2>
                </div>
              </div>
              {trending.map((article) => {
                const headline = cleanNewsText(article.title)
                return (
                  <article className="news-trending-item" key={article.id || article.link}>
                    <SafeImage
                      src={article.image}
                      alt={headline}
                      loading="lazy"
                      className="news-image"
                      fallbackText="RADAR"
                    />
                    <div className="news-trending-body">
                      <div className="news-trending-meta">
                        <span>{article.source} · {formatNewsRelativeTime(article.publishedAt)}</span>
                        <NewsTags article={article} />
                      </div>
                      <h3>{headline}</h3>
                    </div>
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Read ${headline}`}
                    />
                  </article>
                )
              })}
            </aside>
          </div>

          {rest.length > 0 && (
            <section className="news-bottom-section" aria-label="More top stories">
              <div className="news-bottom-grid">
                {rest.map((article) => {
                  const headline = cleanNewsText(article.title)
                  return (
                    <article className="lr-news-card news-bottom-card" key={article.id || article.link}>
                      <div className="news-bottom-thumb">
                        <SafeImage
                          src={article.image}
                          alt={headline}
                          loading="lazy"
                          className="news-image"
                          fallbackText="RADAR"
                        />
                      </div>
                      <div className="lr-news-card__body news-bottom-body">
                        <div className="news-card-meta">
                          <span>{article.source} · {formatNewsRelativeTime(article.publishedAt)}</span>
                          <NewsPlatformBadges platforms={article.platforms} />
                        </div>
                        <NewsTags article={article} />
                        <h3 className="news-bottom-title">{headline}</h3>
                        {article.summary && (
                          <p className="news-bottom-summary">{cleanNewsText(article.summary)}</p>
                        )}
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lr-button lr-button--ghost news-bottom-cta"
                        >
                          Read story →
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
