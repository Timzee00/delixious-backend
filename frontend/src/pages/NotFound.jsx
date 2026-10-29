import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-mono text-6xl font-bold text-pepper">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">This plate's empty</h1>
      <p className="mt-2 text-ink-soft">We couldn't find the page you're looking for.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-pepper px-5 py-2.5 font-semibold text-white hover:bg-pepper-dark"
      >
        Back to Home
      </Link>
    </div>
  );
}
