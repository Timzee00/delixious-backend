-- Staging only: proof-of-delivery code counters and confirmation timestamp.
ALTER TABLE public.delivery_tracking
 ADD COLUMN IF NOT EXISTS proof_attempts smallint NOT NULL DEFAULT 0
   CHECK (proof_attempts BETWEEN 0 AND 5);
ALTER TABLE public.delivery_tracking
 ADD COLUMN IF NOT EXISTS proof_verified_at timestamptz;

-- Set a strong DELIVERY_HANDOFF_SECRET (32+ random chars) in the staging
-- server environment, not the client or repository. Without it delivery
-- completion is disabled rather than silently skipping verification.
