import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvailableDeliveriesSection from '../components/rider/AvailableDeliveriesSection.jsx';
import MyDeliveriesSection from '../components/rider/MyDeliveriesSection.jsx';
import EarningsSection from '../components/rider/EarningsSection.jsx';
import PayoutSetupSection from '../components/rider/PayoutSetupSection.jsx';

const TABS = ['Available', 'My Deliveries', 'Earnings', 'Payout Setup'];

export default function RiderDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('Available');

  const isApproved = profile?.rider_approval_status === 'approved';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Rider Dashboard</h1>

      {!isApproved && (
        <p className="mt-4 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">
          Your rider account is pending approval. You'll be able to claim deliveries once an admin approves your account -
          you can still set up your payout account below in the meantime.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-pepper text-pepper' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Available' && (isApproved ? <AvailableDeliveriesSection /> : <p className="text-sm text-ink-soft">Awaiting approval.</p>)}
        {tab === 'My Deliveries' && <MyDeliveriesSection />}
        {tab === 'Earnings' && <EarningsSection />}
        {tab === 'Payout Setup' && <PayoutSetupSection />}
      </div>
    </div>
  );
}
