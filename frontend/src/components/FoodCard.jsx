import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import { formatNaira } from '../lib/format.js';

export default function FoodCard({ item, onAdd, adding }) {
  const restaurant = item.restaurants;
  return (
    <article className="ticket overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/restaurants/${restaurant?.id || item.restaurant_id}`} className="group block">
        <Img
          src={item.image_url}
          alt={item.name}
          fallbackText={item.name?.[0]}
          frameClassName="h-44 w-full overflow-hidden rounded-t-xl bg-hairline"
          imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/restaurants/${restaurant?.id || item.restaurant_id}`} className="font-display text-base font-bold text-ink hover:text-pepper">
              {item.name}
            </Link>
            <p className="mt-1 truncate text-xs text-ink-soft">{restaurant?.name || 'Restaurant'}</p>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-pepper">{formatNaira(item.price)}</span>
        </div>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{item.description}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-soft">{item.category || 'Menu'}</span>
          <button
            type="button"
            onClick={() => onAdd?.(item)}
            disabled={!onAdd || adding}
            className="rounded-lg bg-pepper px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-pepper-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? 'Adding...' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
