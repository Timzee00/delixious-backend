import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api.js';

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

export default function AvailableDeliveriesSection() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/delivery/available');
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load available deliveries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function claim(orderId) {
    setClaiming(orderId);
    setError('');
    try {
      await api.patch(`/delivery/${orderId}/claim`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to claim this delivery. It may have just been taken by another rider.');
    } finally {
      setClaiming(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading available deliveries...</p>;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Available deliveries</h2>
          <p className="mt-1 text-sm text-ink-soft">Paid orders that are ready for a rider to claim.</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink hover:bg-sand">
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!deliveries.length && !error ? (
        <div className="mt-6 rounded-xl border border-hairline p-6 text-center text-sm text-ink-soft">
          No deliveries are available right now.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {deliveries.map((delivery) => {
            const order = delivery.orders;
            return (
              <article key={delivery.order_id} className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Order #{String(order?.id || delivery.order_id).slice(0, 8)}</p>
                    <h3 className="mt-1 font-semibold text-ink">{order?.restaurants?.name || 'Restaurant'}</h3>
                    <p className="mt-1 text-sm text-ink-soft">{order?.restaurants?.address || 'Restaurant address unavailable'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink-soft">Rider payout</p>
                    <p className="text-lg font-bold text-pepper">{formatMoney(order?.rider_payout_amount)}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-sand p-3 text-sm text-ink">
                  <span className="font-medium">Deliver to:</span> {order?.delivery_address || 'Address unavailable'}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-soft">
                  <span>Order total: {formatMoney(order?.total_amount)}</span>
                  <button
                    type="button"
                    disabled={claiming === delivery.order_id}
                    onClick={() => claim(delivery.order_id)}
                    className="rounded-lg bg-pepper px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {claiming === delivery.order_id ? 'Claiming...' : 'Claim delivery'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
