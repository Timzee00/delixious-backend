import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';

export default function RidersApprovalSection() {
  const [riders, setRiders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await adminApi.listRiders({ limit: 50 });
      setRiders(data.riders);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load riders.');
    }
  }

  async function setApproval(id, status) {
    try {
      await adminApi.setRiderApproval(id, status);
      setRiders((prev) => prev.map((r) => (r.id === id ? { ...r, rider_approval_status: status } : r)));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update rider.');
    }
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {riders === null && <p className="text-sm text-ink-soft">Loading...</p>}
        {riders?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-paper p-4">
            <div>
              <p className="font-medium text-ink">{r.full_name}</p>
              <p className="text-sm text-ink-soft">{r.phone}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-ink-soft">
                Status: {r.rider_approval_status} · Rating: {r.rider_rating_avg || 0} ({r.rider_rating_count || 0})
              </p>
            </div>
            {r.rider_approval_status !== 'approved' && (
              <button
                onClick={() => setApproval(r.id, 'approved')}
                className="rounded-lg bg-jade px-3 py-1.5 text-sm font-semibold text-white"
              >
                Approve
              </button>
            )}
            {r.rider_approval_status !== 'rejected' && (
              <button
                onClick={() => setApproval(r.id, 'rejected')}
                className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-danger"
              >
                Reject
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
            }
