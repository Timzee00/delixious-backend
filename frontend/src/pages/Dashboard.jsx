import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import RestaurantProfileSection from '../components/dashboard/RestaurantProfileSection.jsx';
import MenuManagementSection from '../components/dashboard/MenuManagementSection.jsx';
import OrdersQueueSection from '../components/dashboard/OrdersQueueSection.jsx';

const TABS = ['Profile', 'Menu', 'Orders'];

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState(null); // null = still loading
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState('Profile');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/restaurants/mine');
      setRestaurants(data.restaurants);
      if (data.restaurants.length) setActiveId(data.restaurants[0].id);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your restaurants.');
      setRestaurants([]);
    }
  }

  function handleRestaurantUpdated(updated) {
    setRestaurants((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleRestaurantCreated(created) {
    setRestaurants((prev) => [...(prev || []), created]);
    setActiveId(created.id);
  }

  const activeRestaurant = restaurants?.find((r) => r.id === activeId) || null;

  if (restaurants === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center font-mono text-sm text-ink-soft">
        Loading dashboard...
      </div>
    );
  }

  if (!restaurants.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-ink">Set up your restaurant</h1>
        <p className="mt-2 text-ink-soft">Create your restaurant profile to start receiving orders.</p>
        {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-6">
          <RestaurantProfileSection restaurant={null} onCreated={handleRestaurantCreated} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Restaurant dashboard</h1>
        {restaurants.length > 1 && (
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-lg border border-hairline bg-paper px-3 py-1.5 text-sm text-ink"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-pepper text-pepper' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6">
        {tab === 'Profile' && (
          <RestaurantProfileSection restaurant={activeRestaurant} onUpdated={handleRestaurantUpdated} />
        )}
        {tab === 'Menu' && <MenuManagementSection restaurant={activeRestaurant} />}
        {tab === 'Orders' && <OrdersQueueSection restaurant={activeRestaurant} />}
      </div>
    </div>
  );
}
