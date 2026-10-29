import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import { formatNaira } from '../lib/format.js';

export default function Checkout() {
  const { cart } = useCart();
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!cart || !cart.items.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="ticket p-10">
          <h1 className="font-display text-xl font-bold text-ink">Nothing to check out</h1>
          <p className="mt-2 text-ink-soft">Your cart is empty.</p>
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

  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();
    return data.display_name || null;
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Location services are not available in this browser.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        try {
          const readableAddress = await reverseGeocode(lat, lng);
          if (readableAddress) {
            setAddress(readableAddress);
          } else {
            setError('Got your location, but could not turn it into an address. Please type it in below.');
          }
        } catch {
          setError('Got your location, but could not look up the address. Please type it in below.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setError('Could not get your location. You can still type your address.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim()) {
      setError('Enter a delivery address.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders/checkout', {
        delivery_address: address.trim(),
        delivery_lat: coords?.lat,
        delivery_lng: coords?.lng,
      });
      window.location.href = data.payment.authorization_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start checkout. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Checkout</h1>

      <div className="ticket mt-6 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Order summary</h2>
        <div className="mt-3 space-y-2">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {item.quantity} × {item.menu_item.name}
              </span>
              <span className="font-mono text-ink-soft">{formatNaira(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="ticket-divider mt-3 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">Subtotal</span>
            <span className="font-mono font-semibold text-ink">{formatNaira(cart.subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">Delivery fee is added at checkout.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ticket mt-6 space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Delivery address</h2>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
          className="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-ink placeholder:text-ink-soft/60 focus:border-pepper"
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-sm font-medium text-pepper hover:underline disabled:opacity-60"
        >
          {locating ? 'Locating...' : coords ? 'Location attached ✓' : 'Use my current location'}
        </button>

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-pepper py-3 font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
        >
          {submitting ? 'Redirecting to payment...' : 'Pay with Paystack'}
        </button>
      </form>
    </div>
  );
          }
