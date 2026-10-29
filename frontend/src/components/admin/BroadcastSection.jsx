import { useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';

export default function BroadcastSection() {
  const [form, setForm] = useState({ title: '', message: '', role: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    setSending(true);
    try {
      const { data } = await adminApi.sendBroadcast({
        title: form.title,
        message: form.message,
        role: form.role || undefined,
      });
      setStatus(data.message);
      setForm({ title: '', message: '', role: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send broadcast.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="text-sm font-medium text-ink">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink">Message</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
          rows={4}
          className="mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink">Send to</label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">Everyone</option>
          <option value="customer">Customers only</option>
          <option value="restaurant_owner">Restaurant owners only</option>
          <option value="delivery_agent">Riders only</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {status && <p className="rounded-lg bg-jade/10 px-3 py-2 text-sm text-jade">{status}</p>}

      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-pepper px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {sending ? 'Sending...' : 'Send broadcast'}
      </button>
    </form>
  );
}
