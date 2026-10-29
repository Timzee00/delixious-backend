import { useEffect, useState } from 'react';
import api from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PayoutSetupSection() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ bank_name: '', bank_code: '', account_number: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ bank_name: profile?.rider_bank_name || '', bank_code: '', account_number: profile?.rider_bank_account_number || '' });
  }, [profile]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setMessage(''); setError('');
    try {
      const { data } = await api.post('/auth/rider/bank-details', form);
      setMessage(data.message || 'Payout account saved successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save payout details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-xl">
      <h2 className="text-lg font-semibold text-ink">Payout setup</h2>
      <p className="mt-1 text-sm text-ink-soft">Add the bank account that should receive your delivery payouts.</p>
      {message && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-hairline bg-white p-5 shadow-sm">
        <label className="block"><span className="text-sm font-medium text-ink">Bank name</span><input name="bank_name" value={form.bank_name} onChange={update} required className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 outline-none focus:border-pepper" placeholder="e.g. Access Bank" /></label>
        <label className="block"><span className="text-sm font-medium text-ink">Bank code</span><input name="bank_code" value={form.bank_code} onChange={update} required className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 outline-none focus:border-pepper" placeholder="Your bank's Paystack bank code" /></label>
        <label className="block"><span className="text-sm font-medium text-ink">Account number</span><input name="account_number" value={form.account_number} onChange={update} required inputMode="numeric" maxLength={10} className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 outline-none focus:border-pepper" placeholder="10-digit account number" /></label>
        <p className="text-xs text-ink-soft">Your payout details are submitted securely to Delixious for Paystack payout setup. Never enter your PIN or card details here.</p>
        <button type="submit" disabled={saving} className="rounded-lg bg-pepper px-4 py-2 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save payout account'}</button>
      </form>
    </section>
  );
}
