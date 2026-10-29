import { useEffect, useState } from 'react';
import api from '../../lib/api.js';
import { formatNaira } from '../../lib/format.js';
import Modal from '../Modal.jsx';

const PAGE_SIZE = 20;

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
const NEXT_LABEL = {
  pending: 'Confirm order',
  confirmed: 'Start preparing',
  preparing: 'Mark out for delivery',
  out_for_delivery: 'Mark delivered',
};

const STATUS_STYLES = {
  pending: 'bg-gold text-white',
  confirmed: 'bg-gold text-white',
  preparing: 'bg-gold text-white',
  out_for_delivery: 'bg-pepper text-white',
  delivered: 'bg-jade text-white',
  cancelled: 'bg-ink-soft text-white',
};

export default function OrdersQueueSection({ restaurant }) {
  const [orders, setOrders] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [assigningOrder, setAssigningOrder] = useState(null);

  useEffect(() => {
    setOrders(null);
    setPage(1);
    load(1, false);
    // Light polling for new incoming orders - no realtime channel for
    // orders yet, this keeps the queue reasonably fresh in the meantime.
    const interval = setInterval(() => load(1, false), 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function load(pageToLoad, append) {
    if (append) setLoadingMore(true);
    try {
      const { data } = await api.get(`/restaurants/${restaurant.id}/orders`, {
        params: { page: pageToLoad, limit: PAGE_SIZE },
      });
      setOrders((prev) => (append && prev ? [...prev, ...data.orders] : data.orders));
      setTotal(data.total);
      setPage(pageToLoad);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load orders.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function advanceStatus(order) {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setBusyId(order.id);
    setError('');
    try {
      const { data } = await api.patch(`/orders/${order.id}/status`, { status: nextStatus });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...data.order } : o)));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update order status.');
    } finally {
      setBusyId(null);
    }
  }

  if (orders === null) {
    return <p className="text-center font-mono text-sm text-ink-soft">Loading orders...</p>;
  }

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const pastOrders = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));
  const hasMore = orders.length < total;

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-ink">Incoming orders</h2>
      {error && (
        <p role="alert" aria-live="polite" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {activeOrders.length === 0 ? (
        <p className="mt-6 text-center text-ink-soft">No active orders right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {activeOrders.map((order) => (
            <div key={order.id} className="ticket p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-ink-soft">#{order.id.slice(0, 8)}</p>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[order.status]}`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-ink">
                      {item.quantity} × {item.name_snapshot}
                    </span>
                    <span className="font-mono text-ink-soft">{formatNaira(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-soft">Deliver to: {order.delivery_address}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-ink">{formatNaira(order.total_amount)}</span>
                <div className="flex flex-wrap gap-2">
                  {['confirmed', 'preparing'].includes(order.status) && (
                    <button
                      onClick={() => setAssigningOrder(order)}
                      className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-pepper hover:text-pepper"
                    >
                      Assign rider
                    </button>
                  )}
                  {NEXT_STATUS[order.status] && (
                    <button
                      onClick={() => advanceStatus(order)}
                      disabled={busyId === order.id}
                      className="rounded-lg bg-pepper px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
                    >
                      {busyId === order.id ? 'Updating...' : NEXT_LABEL[order.status]}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pastOrders.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Past orders</h3>
          <div className="mt-3 space-y-2">
            {pastOrders.map((order) => (
              <div key={order.id} className="ticket flex items-center justify-between p-3 text-sm">
                <span className="font-mono text-xs text-ink-soft">#{order.id.slice(0, 8)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${STATUS_STYLES[order.status]}`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
                <span className="font-mono text-ink-soft">{formatNaira(order.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => load(page + 1, true)}
          disabled={loadingMore}
          className="mt-6 w-full rounded-lg border border-hairline py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-60"
        >
          {loadingMore ? 'Loading...' : 'Load more orders'}
        </button>
      )}

      {assigningOrder && <AssignAgentModal order={assigningOrder} onDone={() => setAssigningOrder(null)} />}
    </div>
  );
}

function AssignAgentModal({ order, onDone }) {
  const [phone, setPhone] = useState('');
  const [agents, setAgents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (phone.trim().length < 3) {
      setError('Enter at least 3 digits of their phone number.');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const { data } = await api.get('/delivery/agents/search', { params: { phone: phone.trim() } });
      setAgents(data.agents);
      if (!data.agents.length) setError('No delivery agent found with that number.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not search for agents.');
    } finally {
      setSearching(false);
    }
  }

  async function handleAssign(agent) {
    setAssigning(true);
    setError('');
    try {
      await api.patch(`/delivery/${order.id}/assign-agent`, { delivery_agent_id: agent.id });
      setAssigned(agent);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not assign this agent.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Modal onClose={onDone} labelledBy="assign-agent-title">
      <h3 id="assign-agent-title" className="font-display text-lg font-bold text-ink">
        Assign a delivery rider
      </h3>

      {assigned ? (
        <>
          <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">
            {assigned.full_name} has been assigned to order #{order.id.slice(0, 8)}.
          </p>
          <button
            onClick={onDone}
            className="mt-4 w-full rounded-lg bg-pepper py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Search by the rider's phone number.</p>

          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="080..."
              className="flex-1 rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-pepper px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {error && (
            <p role="alert" aria-live="polite" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {agents.length > 0 && (
            <div className="mt-4 space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{agent.full_name}</p>
                    <p className="text-xs text-ink-soft">{agent.phone}</p>
                  </div>
                  <button
                    onClick={() => handleAssign(agent)}
                    disabled={assigning}
                    className="rounded-lg bg-jade px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-jade/90 disabled:opacity-60"
                  >
                    {assigning ? '...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onDone}
            className="mt-4 w-full rounded-lg border border-hairline py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft"
          >
            Close
          </button>
        </>
      )}
    </Modal>
  );
}
