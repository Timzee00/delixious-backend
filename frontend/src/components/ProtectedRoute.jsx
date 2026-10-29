import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="font-mono text-sm text-ink-soft">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
        <div className="ticket w-full p-8 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-danger">Access restricted</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">You do not have permission to view this page.</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Your account is signed in, but this area is reserved for approved Delixious team roles.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-lg bg-pepper px-5 py-2.5 text-sm font-semibold text-white hover:bg-pepper-dark"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
