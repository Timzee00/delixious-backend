import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api.js';

function nextStatus(status) {
  return { assigned: 'picked_up', picked_up: 'en_route', en_route: 'delivered' }[status];
}

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

export default function MyDeliveriesSection() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/delivery/my-deliveries');
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function advance(delivery) {
    const status = nextStatus(delivery.status);
    if (!status) return;
    setUpdating(delivery.order_id);
    setError('');
    try {
      await api.patch(`/delivery/${delivery.order_id}/status`, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update delivery status.');
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading your deliveries...</p>;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">My deliveries</h2>
          <p className="mt-1 text-sm text-ink-soft">Track active deliveries and move them through the delivery stages.</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink hover:bg-sand">Refresh</button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!deliveries.length && !error ? (
        <div className="mt-6 rounded-xl border border-hairline p-6 text-center text-sm text-ink-soft">You have no active deliveries.</div>
      ) : (
        <div className="mt-6 space-y-4">
          {deliveries.map((delivery) => {
            const order = delivery.orders;
            const next = nextStatus(delivery.status);
            return (
              <article key={delivery.order_id} className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Order #{String(order?.id || delivery.order_id).slice(0, 8)}</p>
                    <h3 className="mt-1 font-semibold text-ink">{order?.restaurants?.name || 'Restaurant'}</h3>
                  </div>
                  <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold capitalize text-ink">{delivery.status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-sand p-3"><span className="font-medium">Pickup:</span> {order?.restaurants?.address || 'Unavailable'}</div>
                  <div className="rounded-lg bg-sand p-3"><span className="font-medium">Drop-off:</span> {order?.delivery_address || 'Unavailable'}</div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-ink-soft">Payout: <strong className="text-ink">{formatMoney(order?.rider_payout_amount)}</strong></span>
                  {next && (
                    <button type="button" disabled={updating === delivery.order_id} onClick={() => advance(delivery)} className="rounded-lg bg-pepper px-4 py-2 font-semibold text-white disabled:opacity-60">
                      {updating === delivery.order_id ? 'Updating...' : next === 'picked_up' ? 'Mark picked up' : next === 'en_route' ? 'Mark en route' : 'Mark delivered'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
