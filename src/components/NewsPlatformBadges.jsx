function PlatformGlyph({ platform }) {
  switch (platform) {
    case 'PC':
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
          <path d="M1.5 2.5h13v8.5h-13V2.5Zm1.2 1.2v6.1h10.6V3.7H2.7ZM6 12.2h4l.8 1.3H5.2L6 12.2Z" />
        </svg>
      )
    case 'PlayStation':
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
          <path d="M6.4 2.2v10.2l2 .7V4.6c0-.6.3-.9.8-.7.5.2.7.6.7 1.2v3.3c1.4.7 2.5 0 2.5-1.9 0-1.8-.6-2.7-2.4-3.3-1-.3-2.4-.7-3.6-1Zm-4.2 8.7c-.9.3-1.1.9-.5 1.3.7.4 1.8.6 3 .2l1.2-.4v-1.2l-1.5.5c-.5.2-1 .1-1.3-.1-.2-.2 0-.4.4-.5l2.4-.8V8.8l-3.7 2.1Zm9.6-.4-2.5.9v1.2l3.7-1.3c.8-.3 1-.9.4-1.3-.6-.4-1.7-.5-2.8-.2l-1.3.4v1.1l1.4-.5c.5-.2 1-.1 1.2.1.3.2.1.4-.1.6Z" />
        </svg>
      )
    case 'Xbox':
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.6 2.3a5.2 5.2 0 0 1 1.5 5.9c-.6-1.4-1.8-2.9-3-4 .5-.7 1-1.4 1.5-1.9Zm-7.2 0c.5.5 1 1.2 1.5 1.9-1.2 1.1-2.4 2.6-3 4a5.2 5.2 0 0 1 1.5-5.9ZM8 4.4c1 .9 2.4 2.4 3.4 4.1.6 1 .8 1.9.7 2.5a5.2 5.2 0 0 1-8.2 0c-.1-.6.1-1.5.7-2.5 1-1.7 2.4-3.2 3.4-4.1Z" />
        </svg>
      )
    case 'Switch':
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
          <path d="M5.2 2A2.2 2.2 0 0 0 3 4.2v7.6A2.2 2.2 0 0 0 5.2 14h2.1V2H5.2Zm.2 3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM8.7 2v12h2.1a2.2 2.2 0 0 0 2.2-2.2V4.2A2.2 2.2 0 0 0 10.8 2H8.7Zm2.1 6.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
        </svg>
      )
    default:
      return null
  }
}

export default function NewsPlatformBadges({ platforms }) {
  if (!Array.isArray(platforms) || platforms.length === 0) return null
  return (
    <span className="news-platform-icons" aria-label={`Platforms: ${platforms.join(', ')}`}>
      {platforms.slice(0, 4).map((platform) => (
        <span
          key={platform}
          className="news-platform-icon"
          title={platform}
          aria-label={platform}
        >
          <PlatformGlyph platform={platform} />
        </span>
      ))}
    </span>
  )
}
