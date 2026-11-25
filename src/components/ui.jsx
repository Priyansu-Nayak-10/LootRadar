export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`lr-button lr-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export function Chip({ active = false, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`lr-chip ${active ? 'is-active' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export function SectionHeader({ kicker, title, highlight, action }) {
  return (
    <header className="lr-section-heading">
      <div className="lr-section-heading__copy">
        {kicker && <span className="lr-section-heading__kicker">{kicker}</span>}
        <h2>{title} {highlight && <strong>{highlight}</strong>}</h2>
      </div>
      {action}
    </header>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`lr-card ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function GameCard({ image, title, children, className = '', imageAlt = '' }) {
  return (
    <article className={`lr-game-card ${className}`.trim()}>
      {image ? (
        <img
          src={image}
          alt={imageAlt || title}
          loading="lazy"
          decoding="async"
          className="lr-game-card__image"
        />
      ) : (
        <div className="lr-art-fallback" aria-label={`${title} artwork unavailable`}>
          WishRadar
        </div>
      )}
      <div className="lr-game-card__body">{children}</div>
    </article>
  )
}

export function NewsCard({ image, title, children, className = '', imageAlt = '' }) {
  return (
    <article className={`lr-news-card ${className}`.trim()}>
      {image ? (
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          className="lr-news-card__image"
        />
      ) : (
        <div className="lr-art-fallback" aria-label="News artwork unavailable">
          WishRadar
        </div>
      )}
      <div className="lr-news-card__body">{children}</div>
    </article>
  )
}

export function Badge({ children, lime = false, className = '' }) {
  return (
    <span className={`lr-badge ${lime ? 'lr-badge--lime' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}

export function Skeleton({ className = '', count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className={`lr-skeleton ${className}`.trim()} key={index} aria-hidden="true" />
      ))}
    </>
  )
}

export function EmptyState({ title, children, className = '' }) {
  return (
    <div className={`lr-empty ${className}`.trim()} role="status">
      <div>
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

export function Carousel({ className = '', children, label = 'Carousel' }) {
  return (
    <div className={`lr-carousel ${className}`.trim()} role="region" aria-label={label}>
      {children}
    </div>
  )
}
