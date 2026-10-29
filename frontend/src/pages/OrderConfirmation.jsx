import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import { formatNaira } from '../lib/format.js';

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const checkoutGroupId = searchParams.get('checkout_group_id');
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const { refreshCart } = useCart();

  const [order, setOrder] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError('');
      try {
        if (reference) {
          const { data } = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);
          if (!cancelled) setPaymentStatus(data.status);
        }

        if (orderId) {
          const { data } = await api.get(`/orders/${orderId}`);
          if (!cancelled) setOrder(data.order);
        } else if (checkoutGroupId) {
          const { data } = await api.get(`/orders/group/${checkoutGroupId}`);
          if (!cancelled && data.orders?.length) setOrder(data.orders[0]);
        }

        await refreshCart();
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Could not confirm your payment right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [checkoutGroupId, orderId, reference, refreshCart]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center font-mono text-sm text-ink-soft">
        Confirming your payment...
      </div>
    );
  }

  const isSuccess = paymentStatus === 'success' || order?.payment_status === 'paid';
  const isFailed = paymentStatus === 'failed';

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="ticket p-8 text-center">
        {error ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-danger">Something went wrong</p>
            <h1 className="mt-2 font-display text-xl font-bold text-ink">Could not confirm payment</h1>
            <p className="mt-2 text-sm text-ink-soft">{error}</p>
            <Link to="/orders" className="mt-5 inline-block text-sm font-semibold text-pepper hover:underline">
              View my orders
            </Link>
          </>
        ) : isSuccess ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-jade">Payment confirmed</p>
            <h1 className="mt-2 font-display text-xl font-bold text-ink">Your order is on its way to the kitchen</h1>
            {order && (
              <p className="mt-2 text-sm text-ink-soft">
                Order #{order.id.slice(0, 8)} · {formatNaira(order.total_amount)}
              </p>
            )}
          </>
        ) : isFailed ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-danger">Payment failed</p>
            <h1 className="mt-2 font-display text-xl font-bold text-ink">We couldn't confirm your payment</h1>
            <p className="mt-2 text-sm text-ink-soft">No charge was completed. You can try again from your cart.</p>
          </>
        ) : (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">Pending</p>
            <h1 className="mt-2 font-display text-xl font-bold text-ink">Payment still processing</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your payment provider may still be confirming the transaction. You can check your order history shortly.
            </p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {order && (
            <Link
              to={`/orders/${order.id}`}
              className="rounded-lg bg-pepper px-5 py-2.5 font-semibold text-white transition-colors hover:bg-pepper-dark"
            >
              {isSuccess ? 'Track my order' : 'View order'}
            </Link>
          )}
          <Link
            to="/orders"
            className="rounded-lg border border-hairline px-5 py-2.5 font-semibold text-ink-soft transition-colors hover:border-ink-soft"
          >
            Order history
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-hairline px-5 py-2.5 font-semibold text-ink-soft transition-colors hover:border-ink-soft"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
