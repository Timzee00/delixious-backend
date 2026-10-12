-- Non-destructive prerequisite for admin account moderation.
-- Review and apply to a staging database before any production rollout.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_role_created
  ON public.profiles (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_rider_queue
  ON public.profiles (rider_approval_status, created_at DESC)
  WHERE role = 'delivery_agent';
CREATE INDEX IF NOT EXISTS idx_restaurants_approval_created
  ON public.restaurants (approval_status, created_at DESC);
-- Account emails remain in auth.users; do not copy them into profiles without
-- an explicit privacy/data-model decision.
