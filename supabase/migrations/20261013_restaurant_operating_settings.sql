-- Run on an isolated staging database before deploying settings endpoints.
-- Existing restaurants remain on manual open/closed mode until owners opt in.
CREATE TABLE IF NOT EXISTS public.restaurant_operating_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  schedule_enabled boolean NOT NULL DEFAULT false,
  prep_time_minutes smallint NOT NULL DEFAULT 30 CHECK (prep_time_minutes BETWEEN 10 AND 180),
  paused_until timestamptz,
  weekly_hours jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_hours_is_array CHECK (jsonb_typeof(weekly_hours) = 'array'),
  CONSTRAINT weekly_hours_seven_days CHECK (jsonb_array_length(weekly_hours) = 7)
);
ALTER TABLE public.restaurant_operating_settings ENABLE ROW LEVEL SECURITY;
-- Service-role backend handles writes; no public RLS policies needed.
