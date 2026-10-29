import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import MenuItemRow from '../components/MenuItemRow.jsx';
import FavoriteButton from '../components/FavoriteButton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function RestaurantDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const isMounted = useRef(true);
  const [restaurant, setRestaurant] = useState(null);
  const [grouped, setGrouped] = useState({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [itemStatus, setItemStatus] = useState({});
  const [conflict, setConflict] = useState(null);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setLoadError('');
      try {
        const requests = [api.get(`/restaurants/${id}`), api.get(`/restaurants/${id}/menu`)];
        if (isAuthenticated) requests.push(api.get('/favorites/restaurants'));
        const [restaurantRes, menuRes, favoriteRes] = await Promise.all(requests);
        if (!cancelled) {
          setRestaurant(restaurantRes.data.restaurant);
          setGrouped(menuRes.data.grouped_by_category || {});
          if (favoriteRes) setIsFavorite((favoriteRes.data.restaurant_ids || []).includes(id));
          else setIsFavorite(false);
        }
      } catch (err) { if (!cancelled) setLoadError(err.response?.data?.error || 'Could not load this restaurant.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id, isAuthenticated]);

  async function toggleFavorite() {
    if (!isAuthenticated || favoriteBusy) return;
    setFavoriteBusy(true); setActionError('');
    try {
      if (isFavorite) await api.delete(`/favorites/restaurants/${id}`);
      else await api.post(`/favorites/restaurants/${id}`);
      setIsFavorite((value) => !value);
    } catch (err) { setActionError(err.response?.data?.error || 'Could not update your favorite.'); }
    finally { setFavoriteBusy(false); }
  }

  async function handleAdd(item, replace = false) {
    if (!isAuthenticated) { setActionError('Log in to add items to your cart.'); return; }
    setActionError(''); setItemStatus((prev) => ({ ...prev, [item.id]: 'adding' }));
    try {
      await api.post('/cart/items', { menu_item_id: item.id, quantity: 1, replace });
      await refreshCart(); setConflict(null);
      if (isMounted.current) {
        setItemStatus((prev) => ({ ...prev, [item.id]: 'added' }));
        setTimeout(() => { if (isMounted.current) setItemStatus((prev) => ({ ...prev, [item.id]: undefined })); }, 1200);
      }
    } catch (err) {
      if (err.response?.status === 409) setConflict({ message: err.response.data.error, item });
      else setActionError(err.response?.data?.error || 'Could not add item to cart.');
      if (isMounted.current) setItemStatus((prev) => ({ ...prev, [item.id]: undefined }));
    }
  }

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-center font-mono text-sm text-ink-soft">Loading restaurant...</div>;
  if (loadError && !restaurant) return <div className="mx-auto max-w-4xl px-4 py-16 text-center"><p className="text-ink-soft">{loadError}</p><Link to="/restaurants" className="mt-4 inline-block text-pepper hover:underline">Back to restaurants</Link></div>;

  const categories = Object.entries(grouped);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="ticket overflow-hidden p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><h1 className="font-display text-2xl font-bold text-ink">{restaurant.name}</h1>{restaurant.cuisine_type && <p className="mt-1 text-sm text-ink-soft">{restaurant.cuisine_type}</p>}{restaurant.address && <p className="mt-1 text-xs text-ink-soft">{restaurant.address}</p>}</div>
          <div className="flex shrink-0 items-center gap-2"><FavoriteButton active={isFavorite} onClick={toggleFavorite} disabled={!isAuthenticated || favoriteBusy} /><span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide ${restaurant.is_open ? 'bg-jade text-white' : 'bg-ink-soft text-white'}`}>{restaurant.is_open ? 'Open' : 'Closed'}</span></div>
        </div>
        {restaurant.rating_count > 0 && <p className="mt-3 font-mono text-sm text-gold">★ {restaurant.rating_avg} ({restaurant.rating_count} reviews)</p>}
        {restaurant.description && <p className="mt-3 text-sm text-ink-soft">{restaurant.description}</p>}
        {!isAuthenticated && <p className="mt-3 text-xs text-ink-soft">Log in to save this restaurant to your favorites.</p>}
      </div>
      {actionError && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}
      {!restaurant.is_open && <p className="mt-4 rounded-lg bg-ink-soft/10 px-3 py-2 text-sm text-ink-soft">This restaurant is currently closed and not accepting orders.</p>}
      <div className="mt-8 space-y-8">{categories.length === 0 && <p className="text-center text-ink-soft">This restaurant hasn't added any available menu items yet.</p>}{categories.map(([category, items]) => <div key={category}><h2 className="font-display text-lg font-bold text-ink">{category}</h2><div className="mt-3 space-y-3">{items.map((item) => <MenuItemRow key={item.id} item={item} status={itemStatus[item.id]} onAdd={() => handleAdd(item)} />)}</div></div>)}</div>
      {conflict && <ConfirmModal title="Switch restaurants?" message={conflict.message} confirmLabel="Replace cart" onCancel={() => setConflict(null)} onConfirm={() => handleAdd(conflict.item, true)} />}
    </div>
  );
}
