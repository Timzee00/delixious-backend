import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import supabase from '../lib/supabase.js';
import { formatNaira } from '../lib/format.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

const STEPS = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export default function OrderTrackingPage() {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [existingReview, setExistingReview] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setTracking(data.order.delivery_tracking?.[0] || null);

      if (data.order.status === 'delivered') {
        const { data: reviewsData } = await api.get('/reviews/mine');
        const match = reviewsData.reviews.find((r) => r.order_id === id);
        if (match) setExistingReview(match);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Live delivery updates via Supabase Realtime. If VITE_SUPABASE_URL/ANON_KEY
  // aren't configured, `supabase` is null and this just no-ops - the page
  // still works, it just needs a manual refresh to see status changes.
  useEffect(() => {
    if (!supabase) return undefined;

    const channel = supabase
      .channel(`delivery-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_tracking', filter: `order_id=eq.${id}` },
        (payload) => {
          if (payload.new) setTracking((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const { data } = await api.patch(`/orders/${id}/cancel`);
      setOrder((prev) => ({ ...prev, ...data.order }));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel this order.');
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (reviewRating < 1) {
      setReviewError('Choose a star rating.');
      return;
    }
    setReviewError('');
    setSubmittingReview(true);
    try {
      const { data } = await api.post('/reviews', { order_id: id, rating: reviewRating, comment: reviewComment });
      setExistingReview(data.review);
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Could not submit your review.');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center font-mono text-sm text-ink-soft">
        Loading order...
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-soft">{error}</p>
        <Link to="/orders" className="mt-4 inline-block text-pepper hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const mapsUrl =
    tracking?.current_lat && tracking?.current_lng
      ? `https://www.google.com/maps?q=${tracking.current_lat},${tracking.current_lng}`
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to orders
      </Link>

      <div className="ticket mt-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-pepper">Order #{order.id.slice(0, 8)}</p>
            <h1 className="mt-1 font-display text-xl font-bold text-ink">{order.restaurants?.name}</h1>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-ink">{formatNaira(order.total_amount)}</span>
        </div>

        {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {isCancelled ? (
          <p className="mt-4 rounded-lg bg-ink-soft/10 px-3 py-2 text-sm text-ink-soft">This order was cancelled.</p>
        ) : (
          <div className="mt-6 flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 flex-col items-center">
                <span className={`h-2.5 w-2.5 rounded-full ${i <= stepIndex ? 'bg-pepper' : 'bg-hairline'}`} />
                <span
                  className={`mt-2 text-center text-[10px] font-mono uppercase leading-tight ${
                    i <= stepIndex ? 'text-ink' : 'text-ink-soft/50'
                  }`}
                >
                  {step.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {tracking && !isCancelled && (
          <div className="ticket-divider mt-6 pt-4">
            <p className="text-sm text-ink-soft">
              Delivery status: <span className="font-semibold text-ink">{tracking.status.replace(/_/g, ' ')}</span>
            </p>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-pepper hover:underline"
              >
                View rider's last known location →
              </a>
            )}
          </div>
        )}

        <div className="ticket-divider mt-6 pt-4">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Items</h3>
          <div className="mt-2 space-y-1">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {item.quantity} × {item.name_snapshot}
                </span>
                <span className="font-mono text-ink-soft">{formatNaira(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Delivering to: {order.delivery_address}</p>
        </div>

        {canCancel && (
          <button onClick={() => setConfirmCancel(true)} className="mt-6 text-sm font-medium text-danger hover:underline">
            Cancel this order
          </button>
        )}
      </div>

      {order.status === 'delivered' && (
        <div className="ticket mt-6 p-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
            {existingReview ? 'Your review' : 'Rate this order'}
          </h3>
          {existingReview ? (
            <div className="mt-3">
              <StarDisplay rating={existingReview.rating} />
              {existingReview.comment && <p className="mt-2 text-sm text-ink-soft">{existingReview.comment}</p>}
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="mt-3 space-y-3">
              <StarPicker value={reviewRating} onChange={setReviewRating} />
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder="How was your order? (optional)"
                className="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper"
              />
              {reviewError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{reviewError}</p>}
              <button
                type="submit"
                disabled={submittingReview}
                className="rounded-lg bg-pepper px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
              >
                {submittingReview ? 'Submitting...' : 'Submit review'}
              </button>
            </form>
          )}
        </div>
      )}

      {confirmCancel && (
        <ConfirmModal
          title="Cancel this order?"
          message="This can't be undone. The restaurant will be notified."
          confirmLabel={cancelling ? 'Cancelling...' : 'Yes, cancel'}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= value ? 'text-gold' : 'text-hairline'}`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating }) {
  return (
    <div className="flex gap-0.5 text-lg leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-gold' : 'text-hairline'}>
          ★
        </span>
      ))}
    </div>
  );
}
