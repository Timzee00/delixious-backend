export default function FavoriteButton({ active, onClick, disabled = false, label = 'Favorite' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${label}` : `Add ${label}`}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-paper transition-colors ${
        active ? 'border-pepper text-pepper' : 'border-hairline text-ink-soft hover:border-pepper hover:text-pepper'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
    </button>
  );
}
