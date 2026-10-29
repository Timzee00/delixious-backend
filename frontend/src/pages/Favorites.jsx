import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import RestaurantCard from '../components/RestaurantCard.jsx';
import { EmptyState, ErrorState, GridSkeleton } from '../components/StateViews.jsx';

export default function Favorites() {
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError('');
    try {
      const { data } = await api.get('/favorites/restaurants');
      setRestaurants(data.favorites || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your favorites.');
      setRestaurants([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id) {
    setBusyId(id);
    try {
      await api.delete(`/favorites/restaurants/${id}`);
      setRestaurants((current) => current.filter((restaurant) => restaurant.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove that restaurant.');
    } finally { setBusyId(null); }
  }

  if (restaurants === null) return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><GridSkeleton /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/" className="text-sm font-medium text-pepper hover:underline">Back to home</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Your favorites</h1>
      <p className="mt-1 text-sm text-ink-soft">Favorite a restaurant and its dishes can be prioritized on your home feed.</p>
      {error && <div className="mt-6"><ErrorState message={error} /></div>}
      {!error && !restaurants.length ? <div className="mt-8"><EmptyState message="You have no favorite restaurants yet. Browse restaurants and tap the heart icon to add one." /></div> : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              isFavorite
              favoriteBusy={busyId === restaurant.id}
              onToggleFavorite={() => remove(restaurant.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
