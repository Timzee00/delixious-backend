import { useState } from 'react';
import api from '../../lib/api.js';
import FormField from '../FormField.jsx';
import ImagePicker from '../ImagePicker.jsx';

const CUISINES = ['Nigerian', 'Continental', 'Chinese', 'Fast Food', 'Grills', 'Seafood', 'Pastries', 'Other'];

export default function RestaurantProfileSection({ restaurant, onCreated, onUpdated }) {
  const isEdit = Boolean(restaurant);
  const [form, setForm] = useState({
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    cuisine_type: restaurant?.cuisine_type || CUISINES[0],
    address: restaurant?.address || '',
    logo_url: restaurant?.logo_url || '',
    cover_image_url: restaurant?.cover_image_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) { setError('Restaurant name and address are required.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      if (isEdit) { const { data } = await api.put(`/restaurants/${restaurant.id}`, form); onUpdated(data.restaurant); setMessage('Restaurant details saved.'); }
      else { const { data } = await api.post('/restaurants', form); onCreated(data.restaurant); setMessage('Restaurant created.'); }
    } catch (err) { setError(err.response?.data?.error || 'Could not save your restaurant.'); }
    finally { setSaving(false); }
  }

  async function handleToggleOpen() {
    setTogglingOpen(true); setError('');
    try { const { data } = await api.patch(`/restaurants/${restaurant.id}/toggle-open`); onUpdated(data.restaurant); }
    catch (err) { setError(err.response?.data?.error || 'Could not update open status.'); }
    finally { setTogglingOpen(false); }
  }

  return (
    <div className="space-y-6">
      {isEdit && (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="ticket p-4"><p className="text-xs font-mono uppercase tracking-wider text-ink-soft">Restaurant status</p><div className="mt-2 flex flex-wrap items-center gap-3"><p className={`font-display text-lg font-bold ${restaurant.is_open ? 'text-jade' : 'text-ink-soft'}`}>{restaurant.is_open ? 'Open for orders' : 'Closed'}</p>{restaurant.approval_status && <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold capitalize text-ink-soft">Approval: {restaurant.approval_status}</span>}</div></div>
          <button onClick={handleToggleOpen} disabled={togglingOpen} className={`rounded-xl border-2 bg-transparent px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${restaurant.is_open ? 'border-ink-soft text-ink-soft hover:bg-ink-soft/10' : 'border-jade text-jade hover:bg-jade/10'}`}>{togglingOpen ? 'Updating...' : restaurant.is_open ? 'Close restaurant' : 'Open restaurant'}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="ticket p-5 sm:p-7">
        <div className="mb-6"><h2 className="font-display text-lg font-bold text-ink">Restaurant details</h2><p className="mt-1 text-sm text-ink-soft">This information helps customers find and recognize your restaurant.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><FormField label="Restaurant name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /></div>
          <div><span className="mb-1 block text-sm font-medium text-ink">Cuisine type</span><select value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} className="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-ink focus:border-pepper">{CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><FormField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} required /></div>
          <div className="md:col-span-2"><FormField label="Description" as="textarea" rows={4} value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Tell customers what makes your restaurant and food worth trying." /></div>
        </div>

        <div className="mt-7 border-t border-hairline pt-6"><h3 className="font-display text-base font-bold text-ink">Branding</h3><p className="mt-1 text-sm text-ink-soft">Use a clear logo and food-focused cover image for the marketplace.</p><div className="mt-4 grid gap-5 sm:grid-cols-2"><ImagePicker label="Logo" url={form.logo_url} category="logo" onUploaded={(url) => setForm((f) => ({ ...f, logo_url: url }))} size="h-28 w-full" /><ImagePicker label="Cover image" url={form.cover_image_url} category="cover" onUploaded={(url) => setForm((f) => ({ ...f, cover_image_url: url }))} size="h-28 w-full" /></div></div>

        {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">{message}</p>}
        {error && <p role="alert" aria-live="polite" className="mt-5 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={saving} className="mt-6 w-full rounded-lg bg-pepper py-3 font-semibold text-white hover:bg-pepper-dark disabled:opacity-60">{saving ? 'Saving...' : isEdit ? 'Save restaurant details' : 'Create restaurant'}</button>
      </form>
    </div>
  );
}
