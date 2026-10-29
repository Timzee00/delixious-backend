import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

const ROLES = [
  { value: 'customer', label: 'Order food' },
  { value: 'restaurant_owner', label: 'Sell food' },
  { value: 'delivery_agent', label: 'Deliver orders' },
];

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'customer' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await signup(form);
      if (data.user) {
        navigate('/', { replace: true });
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="ticket p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-pepper">Get started</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Create your account</h1>

        {message ? (
          <p role="status" aria-live="polite" className="mt-6 rounded-lg bg-jade-soft px-4 py-3 text-sm text-jade">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <FormField label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
            <FormField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <FormField label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <FormField
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              required
            />

            <fieldset>
              <legend className="mb-1 text-sm font-medium text-ink">I want to...</legend>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setForm({ ...form, role: r.value })}
                    aria-pressed={form.role === r.value}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      form.role === r.value
                        ? 'border-pepper bg-pepper/10 text-pepper'
                        : 'border-hairline text-ink-soft hover:border-ink-soft'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {error && (
              <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-pepper py-2.5 font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-pepper hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
