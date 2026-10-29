import { useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import api from '../../lib/api.js';
import { formatNaira } from '../../lib/format.js';
import ConfirmModal from '../ConfirmModal.jsx';
import Modal from '../Modal.jsx';
import FormField from '../FormField.jsx';
import ImagePicker from '../ImagePicker.jsx';
import Img from '../Img.jsx';

const CATEGORIES = ['Starters', 'Main', 'Sides', 'Drinks', 'Desserts', 'Other'];
const VIRTUALIZE_THRESHOLD = 30;
const ROW_HEIGHT = 72;

export default function MenuManagementSection({ restaurant }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/restaurants/${restaurant.id}/menu-management`)
      .then(({ data }) => { if (!cancelled) setItems(data.menu_items || []); })
      .catch((err) => { if (!cancelled) { setError(err.response?.data?.error || 'Could not load your menu.'); setItems([]); } });
    return () => { cancelled = true; };
  }, [restaurant.id]);

  async function toggleAvailability(item) {
    try {
      const { data } = await api.patch(`/menu-items/${item.id}/toggle-availability`);
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.menu_item : i)));
    } catch (err) { setError(err.response?.data?.error || 'Could not update item.'); }
  }

  async function handleDelete() {
    try {
      await api.delete(`/menu-items/${deletingItem.id}`);
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
    } catch (err) { setError(err.response?.data?.error || 'Could not delete item.'); }
    finally { setDeletingItem(null); }
  }

  function handleSaved(saved) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
    setShowForm(false);
    setEditingItem(null);
  }

  if (items === null) return <p className="text-center font-mono text-sm text-ink-soft">Loading menu...</p>;

  const rowProps = { onToggle: toggleAvailability, onEdit: (item) => { setEditingItem(item); setShowForm(true); }, onDelete: setDeletingItem };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Menu items</h2>
        <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="rounded-lg bg-pepper px-4 py-2 text-sm font-semibold text-white hover:bg-pepper-dark">Add item</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {items.length === 0 ? <p className="mt-6 text-center text-ink-soft">No menu items yet. Add your first dish.</p> : items.length > VIRTUALIZE_THRESHOLD ? (
        <div className="mt-6"><List height={Math.min(600, items.length * ROW_HEIGHT)} itemCount={items.length} itemSize={ROW_HEIGHT} width="100%">{({ index, style }) => <div style={style}><MenuItemManageRow item={items[index]} {...rowProps} /></div>}</List></div>
      ) : <div className="mt-6 space-y-3">{items.map((item) => <MenuItemManageRow key={item.id} item={item} {...rowProps} />)}</div>}

      {showForm && <MenuItemForm restaurantId={restaurant.id} item={editingItem} onSaved={handleSaved} onCancel={() => { setShowForm(false); setEditingItem(null); }} />}
      {deletingItem && <ConfirmModal title="Delete this item?" message={`"${deletingItem.name}" will be removed from your menu.`} confirmLabel="Delete" onCancel={() => setDeletingItem(null)} onConfirm={handleDelete} />}
    </div>
  );
}

function MenuItemManageRow({ item, onToggle, onEdit, onDelete }) {
  return (
    <div className="ticket flex h-16 items-center gap-3 px-4">
      <Img src={item.image_url} alt={item.name} fallbackText={item.name?.[0]} frameClassName="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-hairline" />
      <div className="min-w-0 flex-1"><h4 className="truncate font-display text-sm font-bold text-ink">{item.name}</h4><p className="truncate text-xs text-ink-soft">{item.category || 'Uncategorized'}</p></div>
      <span className="shrink-0 font-mono text-sm font-semibold text-pepper">{formatNaira(item.price)}</span>
      <button onClick={() => onToggle(item)} className={`shrink-0 rounded-full px-2 py-1 font-mono text-[10px] font-semibold uppercase ${item.is_available ? 'bg-jade-soft text-jade' : 'bg-ink-soft/10 text-ink-soft'}`}>{item.is_available ? 'Available' : 'Sold out'}</button>
      <button onClick={() => onEdit(item)} className="shrink-0 text-sm font-medium text-ink-soft hover:text-ink">Edit</button>
      <button onClick={() => onDelete(item)} className="shrink-0 text-sm font-medium text-ink-soft hover:text-danger">Delete</button>
    </div>
  );
}

function MenuItemForm({ restaurantId, item, onSaved, onCancel }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({ name: item?.name || '', description: item?.description || '', price: item?.price ?? '', category: item?.category || CATEGORIES[0], image_url: item?.image_url || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || form.price === '') { setError('Name and price are required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, price: Number(form.price) };
      const { data } = isEdit ? await api.put(`/menu-items/${item.id}`, payload) : await api.post(`/restaurants/${restaurantId}/menu`, payload);
      onSaved(data.menu_item);
    } catch (err) { setError(err.response?.data?.error || 'Could not save this item.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onCancel} labelledBy="menu-item-form-title" className="max-h-[90vh] max-w-md overflow-y-auto">
      <form onSubmit={handleSubmit}>
        <h3 id="menu-item-form-title" className="font-display text-lg font-bold text-ink">{isEdit ? 'Edit item' : 'Add menu item'}</h3>
        <div className="mt-4 space-y-3">
          <FormField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FormField label="Price (₦)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
          <div><span className="mb-1 block text-sm font-medium text-ink">Category</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-ink focus:border-pepper">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <FormField label="Description" as="textarea" rows={2} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <ImagePicker label="Photo" url={form.image_url} category="menu-item" onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))} size="h-24 w-24" />
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex gap-3"><button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-hairline py-2 text-sm font-medium text-ink-soft hover:border-ink-soft">Cancel</button><button type="submit" disabled={saving} className="flex-1 rounded-lg bg-pepper py-2 text-sm font-semibold text-white hover:bg-pepper-dark disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
