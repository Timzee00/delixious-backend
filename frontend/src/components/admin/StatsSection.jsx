import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-hairline bg-paper p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default function StatsSection() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getStats()
      .then(({ data }) => setStats(data.stats))
      .catch((err) => setError(err.response?.data?.error || 'Could not load stats.'));
  }, []);

  if (error) return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
  if (!stats) return <p className="text-sm text-ink-soft">Loading stats...</p>;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Restaurants" value={stats.total_restaurants} />
      <StatCard label="Pending Restaurants" value={stats.pending_restaurants} />
      <StatCard label="Riders" value={stats.total_riders} />
      <StatCard label="Pending Riders" value={stats.pending_riders} />
      <StatCard label="Customers" value={stats.total_customers} />
      <StatCard label="Total Orders" value={stats.total_orders} />
      <StatCard label="Revenue" value={`₦${Number(stats.total_revenue).toLocaleString()}`} />
      <StatCard label="Platform Commission" value={`₦${Number(stats.total_commission).toLocaleString()}`} />
    </div>
  );
}
