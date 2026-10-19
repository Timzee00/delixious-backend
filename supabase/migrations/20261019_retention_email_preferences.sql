-- Staging-only: permission-controlled email choices.
-- Order tracking and in-app operational notices are never disabled here.
CREATE TABLE IF NOT EXISTS public.customer_email_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 order_updates_email boolean NOT NULL DEFAULT true,
 promotional_email_opt_in boolean NOT NULL DEFAULT false,
 promotional_consent_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT marketing_consent_required CHECK (
   promotional_email_opt_in=false OR promotional_consent_at IS NOT NULL
 )
);
ALTER TABLE public.customer_email_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_email_preferences FROM anon,authenticated;
