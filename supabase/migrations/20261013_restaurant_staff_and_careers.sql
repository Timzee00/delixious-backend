-- Staging migration only. Do not run against production without review.
CREATE TABLE IF NOT EXISTS public.restaurant_staff (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_role text NOT NULL CHECK (staff_role IN ('manager','kitchen','counter')),
  active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user
  ON public.restaurant_staff(user_id, active, restaurant_id);

CREATE TABLE IF NOT EXISTS public.restaurant_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  staff_role text NOT NULL CHECK (staff_role IN ('manager','kitchen','counter')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  CONSTRAINT invite_expires_later CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_staff_invites_restaurant
  ON public.restaurant_staff_invites(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (length(description) BETWEEN 20 AND 5000),
  location text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('full_time','part_time','contract','internship')),
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restaurant_jobs_public
  ON public.restaurant_jobs(restaurant_id, created_at DESC) WHERE published = true;

CREATE TABLE IF NOT EXISTS public.restaurant_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.restaurant_jobs(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text,
  cover_note text NOT NULL,
  privacy_consent_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','shortlisted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restaurant_job_applications
  ON public.restaurant_job_applications(job_id, created_at DESC);

ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_job_applications ENABLE ROW LEVEL SECURITY;
-- Backend service-role API authorizes requests; no anon policies.
