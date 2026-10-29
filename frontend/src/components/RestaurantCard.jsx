import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import FavoriteButton from './FavoriteButton.jsx';

export default function RestaurantCard({ restaurant, isFavorite = false, onToggleFavorite, favoriteBusy = false }) {
  return (
    <article className="ticket group block overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative">
        <Link to={`/restaurants/${restaurant.id}`} className="block">
          <Img
            src={restaurant.cover_image_url || restaurant.logo_url}
            alt={restaurant.name}
            fallbackText={restaurant.name?.[0]}
            frameClassName="h-36 w-full overflow-hidden rounded-t-xl bg-hairline"
            imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        {onToggleFavorite && (
          <div className="absolute right-3 top-3">
            <FavoriteButton active={isFavorite} onClick={onToggleFavorite} disabled={favoriteBusy} />
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/95 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-ink">
          {restaurant.is_open ? 'Open' : 'Closed'}
        </span>
      </div>
      <Link to={`/restaurants/${restaurant.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-base font-bold text-ink">{restaurant.name}</h3>
          {restaurant.rating_count > 0 && <span className="shrink-0 font-mono text-xs font-semibold text-gold">{restaurant.rating_avg}</span>}
        </div>
        {restaurant.cuisine_type && <p className="mt-1 truncate text-sm text-ink-soft">{restaurant.cuisine_type}</p>}
        {restaurant.address && <p className="mt-2 truncate text-xs text-ink-soft">{restaurant.address}</p>}
      </Link>
    </article>
  );
}
