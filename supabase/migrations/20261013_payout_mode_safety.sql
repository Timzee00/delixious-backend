-- Staging only: prevents test payment subaccounts from being used in live checkout.
-- Existing connected subaccounts require review and controlled mode backfill.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payout_mode text
    CONSTRAINT restaurants_payout_mode_check CHECK (payout_mode IN ('test', 'live'));

-- Do not automatically mark unknown existing connections as live.
