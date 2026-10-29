import { formatNaira } from '../lib/format.js';
import Img from './Img.jsx';

export default function MenuItemRow({ item, onAdd, status }) {
  const isAdding = status === 'adding';
  const justAdded = status === 'added';

  return (
    <div className="ticket flex items-center gap-4 p-4">
      <Img
        src={item.image_url}
        fallbackText={item.name?.[0]}
        frameClassName="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-hairline"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-display text-sm font-bold text-ink">{item.name}</h4>
        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{item.description}</p>}
        <p className="mt-1 font-mono text-sm font-semibold text-pepper">{formatNaira(item.price)}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={!item.is_available || isAdding}
        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
          !item.is_available
            ? 'cursor-not-allowed bg-hairline text-ink-soft'
            : justAdded
              ? 'bg-jade text-white'
              : 'bg-pepper text-white hover:bg-pepper-dark'
        }`}
      >
        {!item.is_available ? 'Sold out' : isAdding ? 'Adding...' : justAdded ? 'Added ✓' : 'Add'}
      </button>
    </div>
  );
}
