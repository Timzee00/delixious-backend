-- Development/staging only. Verify on an isolated Supabase instance.
-- Sensitive email content (including staff invitation URLs) is AES-256-GCM
-- encrypted before storage. No user-facing RLS access is granted.
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'staff_invitation','job_application_received','job_application_confirmation',
    'order_paid','restaurant_order_received','order_accepted','delivery_assigned'
  )),
  recipient_email text NOT NULL,
  recipient_name text,
  payload_ciphertext text NOT NULL,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','accepted','delivered','deferred','failed','uncertain','bounced','blocked')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  provider_message_id text UNIQUE,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_ready
  ON public.email_outbox(next_attempt_at,created_at)
  WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON public.email_outbox(status,created_at DESC);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;

-- Claim jobs with row-level locking, safe even if two workers poll together.
-- Expired leases are NOT automatically retried: provider acceptance could
-- have happened just before a worker crash. Such jobs go to manual review.
CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 5)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_outbox AS q SET
    status='processing', attempts=q.attempts+1,
    lease_until=now()+interval '2 minutes', updated_at=now()
  WHERE q.id IN (
    SELECT id FROM public.email_outbox
    WHERE status='pending' AND next_attempt_at<=now() AND attempts<7
    ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit,1),10)
  )
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_email_outbox_leases()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE changed integer;
BEGIN
  UPDATE public.email_outbox SET
    status='uncertain', last_error='Worker lease expired; verify with Brevo before retry.',
    lease_until=null, updated_at=now()
  WHERE status='processing' AND lease_until<now();
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_email_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_email_outbox_leases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_email_outbox_leases() TO service_role;
-- Retention/cleanup must be implemented with scheduled operations and
-- a defined policy before production; don't leave encrypted PII indefinitely.
