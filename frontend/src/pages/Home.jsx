import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import FoodCard from '../components/FoodCard.jsx';
import RestaurantCard from '../components/RestaurantCard.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import FeaturedCarousel from '../components/FeaturedCarousel.jsx';
import { GridSkeleton, EmptyState, ErrorState } from '../components/StateViews.jsx';

const CUISINES = ['All', 'Nigerian', 'Continental', 'Chinese', 'Fast Food', 'Grills', 'Seafood', 'Pastries'];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [cuisine, setCuisine] = useState('All');
  const [foods, setFoods] = useState([]);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(new Set());
  const [foodLoading, setFoodLoading] = useState(true);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [foodError, setFoodError] = useState('');
  const [restaurantError, setRestaurantError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const [addBusy, setAddBusy] = useState(null);
  const [cartConflict, setCartConflict] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadFavoriteFoods(ids) {
    if (!isAuthenticated || !ids.length) {
      setFavoriteFoods([]);
      return;
    }

    try {
      const { data } = await api.get('/menu-items/feed', {
        params: { page: 1, limit: 8, restaurant_ids: ids.join(',') },
      });
      setFavoriteFoods(data.menu_items || []);
    } catch {
      setFavoriteFoods([]);
      setFavoriteError('Could not load food from your favorite restaurants.');
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFoods() {
      setFoodLoading(true);
      setFoodError('');
      try {
        const { data } = await api.get('/menu-items/feed', {
          params: {
            page: 1,
            limit: 12,
            ...(debouncedQuery ? { q: debouncedQuery } : {}),
            ...(cuisine !== 'All' ? { cuisine } : {}),
          },
        });
        if (!cancelled) setFoods(data.menu_items || []);
      } catch (err) {
        if (!cancelled) setFoodError(err.response?.data?.error || 'Could not load dishes right now.');
      } finally {
        if (!cancelled) setFoodLoading(false);
      }
    }

    loadFoods();
    return () => { cancelled = true; };
  }, [debouncedQuery, cuisine]);

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurants() {
      setRestaurantLoading(true);
      setRestaurantError('');
      try {
        const { data } = await api.get('/restaurants', { params: { page: 1, limit: 8 } });
        if (!cancelled) setRestaurants(data.restaurants || []);
      } catch (err) {
        if (!cancelled) setRestaurantError(err.response?.data?.error || 'Could not load restaurants right now.');
      } finally {
        if (!cancelled) setRestaurantLoading(false);
      }
    }

    loadRestaurants();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      if (!isAuthenticated) {
        setFavoriteIds(new Set());
        setFavoriteFoods([]);
        setFavoriteError('');
        return;
      }

      try {
        const { data } = await api.get('/favorites/restaurants');
        if (cancelled) return;
        const ids = data.restaurant_ids || [];
        setFavoriteIds(new Set(ids));
        setFavoriteError('');
        await loadFavoriteFoods(ids);
      } catch (err) {
        if (!cancelled) {
          setFavoriteIds(new Set());
          setFavoriteFoods([]);
          setFavoriteError(err.response?.data?.error || 'Could not load your favorites right now.');
        }
      }
    }

    loadFavorites();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  async function toggleFavorite(id) {
    if (!isAuthenticated) return;
    setFavoriteBusy((current) => new Set(current).add(id));
    setFavoriteError('');
    try {
      const nextIds = new Set(favoriteIds);
      if (nextIds.has(id)) {
        await api.delete(`/favorites/restaurants/${id}`);
        nextIds.delete(id);
      } else {
        await api.post(`/favorites/restaurants/${id}`);
        nextIds.add(id);
      }
      setFavoriteIds(nextIds);
      await loadFavoriteFoods([...nextIds]);
    } catch (err) {
      setFavoriteError(err.response?.data?.error || 'Could not update your favorites.');
    } finally {
      setFavoriteBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function addToCart(item, replace = false) {
    if (!isAuthenticated) return setFoodError('Log in to add food to your cart.');
    setAddBusy(item.id);
    try {
      await api.post('/cart/items', { menu_item_id: item.id, quantity: 1, replace });
      await refreshCart();
      setCartConflict(null);
    } catch (err) {
      if (err.response?.status === 409) setCartConflict({ item, message: err.response.data.error });
      else setFoodError(err.response?.data?.error || 'Could not add that dish to your cart.');
    } finally {
      setAddBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="ticket overflow-hidden p-6 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-widest text-pepper">Lagos · Abuja · Port Harcourt</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-5xl">What are you eating today?</h1>
            <p className="mt-3 max-w-2xl text-ink-soft">Browse dishes first. Save the restaurants you love and Delixious will keep their food closer to the top of your feed.</p>
          </div>
          <Link to="/restaurants" className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-ink hover:border-pepper hover:text-pepper">Browse all restaurants</Link>
        </div>
        <div className="mt-7">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a dish..." aria-label="Search for a dish" className="w-full rounded-xl border border-hairline bg-paper px-4 py-3.5 text-ink placeholder:text-ink-soft/60" />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {CUISINES.map((item) => (
          <button key={item} type="button" onClick={() => setCuisine(item)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${cuisine === item ? 'border-pepper bg-pepper/10 text-pepper' : 'border-hairline text-ink-soft hover:border-ink-soft'}`}>
            {item}
          </button>
        ))}
      </div>

      {!foodLoading && !debouncedQuery && foods.length > 0 && (
        <section className="mt-10">
          <FeaturedCarousel
            items={foods.slice(0, 8)}
            onAdd={addToCart}
            addingId={addBusy}
          />
        </section>
      )}

      {isAuthenticated && favoriteFoods.length > 0 && !debouncedQuery && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-pepper">Personalized for you</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">From your favorite restaurants</h2>
            </div>
            <Link to="/favorites" className="text-sm font-semibold text-pepper hover:underline">Manage favorites</Link>
          </div>
          {favoriteError && <p className="mt-3 text-sm text-ink-soft">{favoriteError}</p>}
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {favoriteFoods.map((item) => <FoodCard key={item.id} item={item} onAdd={addToCart} adding={addBusy === item.id} />)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-pepper">Fresh from the marketplace</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">Discover dishes</h2>
            {debouncedQuery && <p className="mt-1 text-sm text-ink-soft">Showing results for “{debouncedQuery}”.</p>}
          </div>
        </div>
        {foodLoading ? (
          <div className="mt-5"><GridSkeleton /></div>
        ) : foodError ? (
          <div className="mt-5"><ErrorState message={foodError} /></div>
        ) : foods.length ? (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {foods.map((item) => <FoodCard key={item.id} item={item} onAdd={addToCart} adding={addBusy === item.id} />)}
          </div>
        ) : (
          <div className="mt-5"><EmptyState message="No dishes match that search yet." /></div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-pepper">Explore by restaurant</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">Restaurants</h2>
          </div>
          <Link to="/restaurants" className="text-sm font-semibold text-pepper hover:underline">See more</Link>
        </div>
        {restaurantLoading ? (
          <div className="mt-5"><GridSkeleton /></div>
        ) : restaurantError ? (
          <div className="mt-5"><ErrorState message={restaurantError} /></div>
        ) : restaurants.length ? (
          <div className="no-scrollbar mt-5 flex snap-x gap-5 overflow-x-auto pb-3">
            {restaurants.map((restaurant) => (
              <div key={restaurant.id} className="w-[280px] shrink-0 snap-start sm:w-[320px]">
                <RestaurantCard restaurant={restaurant} isFavorite={favoriteIds.has(restaurant.id)} favoriteBusy={favoriteBusy.has(restaurant.id)} onToggleFavorite={isAuthenticated ? () => toggleFavorite(restaurant.id) : undefined} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5"><EmptyState message="No approved restaurants are available yet." /></div>
        )}
      </section>

      {!isAuthenticated && <div className="mt-10 rounded-xl border border-hairline bg-paper p-5 text-sm text-ink-soft">Create an account to save favorite restaurants, keep a personalized dish feed, and place orders.</div>}
      {cartConflict && <ConfirmModal title="Switch restaurants?" message={cartConflict.message} confirmLabel="Replace cart" onCancel={() => setCartConflict(null)} onConfirm={() => addToCart(cartConflict.item, true)} />}
    </div>
  );
}
