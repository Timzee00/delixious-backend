import { useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import api from '../lib/api.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';

const PAGE_SIZE = 20;
// Above this many loaded notifications, switch to a virtualized (react-window)
// list so the DOM only holds rows actually in view - real, unread users can
// accumulate hundreds of these over time.
const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 76;

const TYPE_LABELS = {
  order_update: 'Order update',
  payment: 'Payment',
  promo: 'Promo',
  general: 'Notification',
};

export default function Notifications() {
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(pageToLoad, append) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/notifications', { params: { page: pageToLoad, limit: PAGE_SIZE } });
      setNotifications((prev) => (append ? [...prev, ...data.notifications] : data.notifications));
      setTotal(data.total);
      setPage(pageToLoad);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      refreshUnreadCount();
    } catch {
      // non-critical - silently ignore
    }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshUnreadCount();
    } catch {
      // non-critical - silently ignore
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      refreshUnreadCount();
    } catch {
      // non-critical - silently ignore
    }
  }

  const hasUnread = notifications.some((n) => !n.is_read);
  const hasMore = notifications.length < total;
  const rowProps = { onRead: markRead, onRemove: remove };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Notifications</h1>
        {hasUnread && (
          <button onClick={markAllRead} className="text-sm font-medium text-pepper hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-center font-mono text-sm text-ink-soft">Loading...</p>
        ) : error ? (
          <ErrorState message={error} />
        ) : notifications.length === 0 ? (
          <EmptyState message="No notifications yet." />
        ) : notifications.length > VIRTUALIZE_THRESHOLD ? (
          <List
            height={Math.min(640, notifications.length * ROW_HEIGHT)}
            itemCount={notifications.length}
            itemSize={ROW_HEIGHT}
            width="100%"
          >
            {({ index, style }) => (
              <div style={style}>
                <NotificationRow notification={notifications[index]} compact {...rowProps} />
              </div>
            )}
          </List>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} {...rowProps} />
            ))}
          </div>
        )}

        {hasMore && notifications.length <= VIRTUALIZE_THRESHOLD && (
          <button
            onClick={() => load(page + 1, true)}
            disabled={loadingMore}
            className="mt-6 w-full rounded-lg border border-hairline py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification: n, onRead, onRemove, compact = false }) {
  return (
    <div
      onClick={() => !n.is_read && onRead(n.id)}
      className={`ticket flex items-start gap-3 p-4 ${!n.is_read ? 'cursor-pointer border-pepper/30' : ''} ${compact ? 'mb-3' : ''}`}
    >
      <div className="mt-1 w-2 shrink-0">{!n.is_read && <span className="block h-2 w-2 rounded-full bg-pepper" />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
            {TYPE_LABELS[n.type] || 'Notification'}
          </p>
          <span className="shrink-0 text-[11px] text-ink-soft/70">{new Date(n.created_at).toLocaleDateString()}</span>
        </div>
        <h4 className="mt-0.5 truncate font-display text-sm font-bold text-ink">{n.title}</h4>
        {n.body && <p className={`mt-1 text-sm text-ink-soft ${compact ? 'truncate' : ''}`}>{n.body}</p>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(n.id);
        }}
        className="shrink-0 text-lg leading-none text-ink-soft/50 transition-colors hover:text-danger"
        aria-label="Delete notification"
      >
        ×
      </button>
    </div>
  );
}
