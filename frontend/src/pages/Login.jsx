import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

function FeatureIcon({ type }) {
  const common = 'h-5 w-5';

  if (type === 'search') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'bag') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="M6.5 8.5h11l1 11h-13l1-11Z" strokeLinejoin="round" />
        <path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
      <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" strokeLinejoin="round" />
      <path d="M4.5 7.5 12 11l7.5-3.5M12 11v9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log in. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-sand px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-hairline bg-paper shadow-[0_24px_80px_rgba(36,21,18,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative min-h-[470px] overflow-hidden bg-ink p-7 text-white sm:p-10 lg:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pepper/30 blur-2xl" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute right-8 top-20 h-2 w-2 rounded-full bg-gold" />
          <div className="absolute right-20 top-32 h-1.5 w-1.5 rounded-full bg-white/60" />
          <div className="absolute bottom-20 right-12 h-2 w-2 rounded-full bg-pepper" />

          <div className="relative z-10 flex h-full flex-col">
            <Link to="/" className="inline-flex w-fit items-center gap-2 font-display text-2xl font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-pepper text-sm font-black">D</span>
              Delixious
            </Link>

            <div className="mt-14 max-w-lg sm:mt-16">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">Good food. Good mood.</p>
              <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
                Your next great meal is closer than you think.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/70 sm:text-base">
                Sign in to discover restaurants, manage your orders, save favourites and keep your food journey in one place.
              </p>
            </div>

            <div className="mt-auto hidden grid-cols-3 gap-3 pt-12 sm:grid">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-gold">
                  <FeatureIcon type="search" />
                </div>
                <p className="font-display text-sm font-semibold">Discover</p>
                <p className="mt-1 text-xs leading-5 text-white/50">Find meals you will love.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-gold">
                  <FeatureIcon type="bag" />
                </div>
                <p className="font-display text-sm font-semibold">Order</p>
                <p className="mt-1 text-xs leading-5 text-white/50">Keep everything organised.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-gold">
                  <FeatureIcon type="box" />
                </div>
                <p className="font-display text-sm font-semibold">Track</p>
                <p className="mt-1 text-xs leading-5 text-white/50">Follow your order with ease.</p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/45">
              <Link to="/" className="transition-colors hover:text-white">Home</Link>
              <Link to="/restaurants" className="transition-colors hover:text-white">Browse menu</Link>
              <Link to="/signup" className="transition-colors hover:text-white">Create account</Link>
            </div>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-8">
              <span className="inline-flex rounded-full bg-pepper/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-pepper">
                Welcome back
              </span>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Log in to Delixious</h1>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Pick up where you left off and get back to your favourite meals.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField
                label="Email"
                type="email"
                value={form.email}
                placeholder="you@example.com"
                onChange={(v) => setForm({ ...form, email: v })}
                required
              />
              <FormField
                label="Password"
                type="password"
                value={form.password}
                placeholder="Enter your password"
                onChange={(v) => setForm({ ...form, password: v })}
                required
              />

              {error && (
                <div role="alert" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">!</span>
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group w-full rounded-xl bg-pepper py-3.5 font-semibold text-white shadow-lg shadow-pepper/15 transition-all hover:-translate-y-0.5 hover:bg-pepper-dark hover:shadow-xl disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Logging in...
                    </>
                  ) : (
                    <>Log in <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span></>
                  )}
                </span>
              </button>
            </form>

            <div className="my-7 flex items-center gap-3 text-[11px] uppercase tracking-widest text-ink-soft/50">
              <span className="h-px flex-1 bg-hairline" />
              <span>Delixious</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>

            <p className="text-center text-sm text-ink-soft">
              New to Delixious?{' '}
              <Link to="/signup" className="font-semibold text-pepper hover:underline">
                Create an account
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-ink-soft/60">
              By continuing, you agree to use Delixious responsibly and keep your account details secure.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
