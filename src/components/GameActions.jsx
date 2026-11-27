export default function GameActions({
  owned,
  wishlisted,
  onToggleOwned,
  onToggleWishlist,
}) {
  return (
    <div className="game-actions">
      <button
        type="button"
        onClick={onToggleOwned}
        aria-pressed={owned}
        className={`game-action ${owned ? 'is-on' : ''}`}
      >
        {owned ? 'Owned' : 'I own this'}
      </button>
      <button
        type="button"
        onClick={onToggleWishlist}
        aria-pressed={wishlisted}
        className={`game-action ${wishlisted ? 'is-on' : ''}`}
      >
        {wishlisted ? 'Wishlisted' : 'Add to wishlist'}
      </button>
    </div>
  )
}
