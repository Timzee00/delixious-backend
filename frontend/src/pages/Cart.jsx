import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import { formatNaira } from '../lib/format.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Img from '../components/Img.jsx';

export default function Cart() {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  if (!cart) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center font-mono text-sm text-ink-soft">
        Loading your cart...
      </div>
    );
  }

  const { items, subtotal, cart: cartMeta } = cart;

  if (!items.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="ticket p-10">
          <p className="font-mono text-xs uppercase tracking-widest text-pepper">Empty</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Your cart is empty</h1>
          <p className="mt-2 text-ink-soft">Find something delicious to order.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-pepper px-5 py-2.5 font-semibold text-white hover:bg-pepper-dark"
          >
            Browse restaurants
          </Link>
        </div>
      </div>
    );
  }

  async function updateQuantity(menuItemId, quantity) {
    setError('');
    setBusyId(menuItemId);
    try {
      if (quantity < 1) {
        await api.delete(`/cart/items/${menuItemId}`);
      } else {
        await api.put(`/cart/items/${menuItemId}`, { quantity });
      }
      await refreshCart();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update your cart.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(menuItemId) {
    setError('');
    setBusyId(menuItemId);
    try {
      await api.delete(`/cart/items/${menuItemId}`);
      await refreshCart();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove that item.');
    } finally {
      setBusyId(null);
    }
  }

  async function clearCart() {
    try {
      await api.delete('/cart');
      await refreshCart();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not clear your cart.');
    } finally {
      setConfirmClear(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Your cart</h1>
        <button onClick={() => setConfirmClear(true)} className="text-sm font-medium text-ink-soft hover:text-danger">
          Clear cart
        </button>
      </div>
      {cartMeta?.restaurant && <p className="mt-1 text-sm text-ink-soft">From {cartMeta.restaurant.name}</p>}

      {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-3">
        {items.map((item) => {
          const menuItemId = item.menu_item.id;
          const busy = busyId === menuItemId;
          return (
            <div key={item.id} className="ticket flex items-center gap-4 p-4">
              <Img
                src={item.menu_item.image_url}
                fallbackText={item.menu_item.name?.[0]}
                frameClassName="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-hairline"
              />
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-display text-sm font-bold text-ink">{item.menu_item.name}</h4>
                <p className="mt-1 font-mono text-sm font-semibold text-pepper">{formatNaira(item.menu_item.price)}</p>
                {item.special_instructions && (
                  <p className="mt-1 text-xs italic text-ink-soft">"{item.special_instructions}"</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => updateQuantity(menuItemId, item.quantity - 1)}
                  disabled={busy}
                  className="h-7 w-7 rounded-full border border-hairline text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(menuItemId, item.quantity + 1)}
                  disabled={busy}
                  className="h-7 w-7 rounded-full border border-hairline text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-50"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeItem(menuItemId)}
                disabled={busy}
                className="shrink-0 text-ink-soft/60 transition-colors hover:text-danger disabled:opacity-50"
                aria-label="Remove item"
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ticket-divider mt-6" />

      <div className="mt-6 flex items-center justify-between">
        <span className="text-ink-soft">Subtotal</span>
        <span className="font-mono text-lg font-semibold text-ink">{formatNaira(subtotal)}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Delivery fee is calculated at checkout.</p>

      <button
        onClick={() => navigate('/checkout')}
        className="mt-6 w-full rounded-lg bg-pepper py-3 font-semibold text-white transition-colors hover:bg-pepper-dark"
      >
        Proceed to checkout
      </button>

      {confirmClear && (
        <ConfirmModal
          title="Clear your cart?"
          message="This will remove every item currently in your cart."
          confirmLabel="Clear cart"
          onCancel={() => setConfirmClear(false)}
          onConfirm={clearCart}
        />
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
