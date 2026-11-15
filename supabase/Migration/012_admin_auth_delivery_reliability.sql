-- Delixious production reliability: auth recovery, HQ reporting, admin controls and delivery indexes.
-- Additive migration only. Existing profile/order/delivery records are preserved.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

UPDATE public.profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM u.email;

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_created
  ON public.profiles (role, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_restaurants_approval_created
  ON public.restaurants (approval_status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_orders_created_id
  ON public.orders (created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_claim_queue
  ON public.delivery_tracking (status, updated_at ASC, order_id)
  WHERE delivery_agent_id IS NULL;

-- Keep the profile email mirror synchronized with Supabase Auth.
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_auth_email ON auth.users;
CREATE TRIGGER trg_profiles_sync_auth_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email_from_auth();

-- New auth users now get an email mirror; conflict handling preserves their role/suspension.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

-- Admin overview is computed from live tables; no manually-maintained counters or stale cache.
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT
  (SELECT COUNT(*)::bigint FROM public.restaurants) AS total_restaurants,
  (SELECT COUNT(*)::bigint FROM public.restaurants WHERE approval_status = 'pending') AS pending_restaurants,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'delivery_agent') AS total_riders,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'delivery_agent' AND rider_approval_status = 'pending') AS pending_riders,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'customer') AS total_customers,
  (SELECT COUNT(*)::bigint FROM public.orders) AS total_orders,
  (SELECT COALESCE(SUM(total_amount), 0)::numeric(14,2) FROM public.orders WHERE payment_status = 'paid') AS total_revenue,
  (SELECT COALESCE(SUM(platform_commission), 0)::numeric(14,2) FROM public.orders WHERE payment_status = 'paid') AS total_commission;

REVOKE ALL ON public.admin_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_stats TO service_role;

-- Bulk insert for HQ broadcasts: one set-based database operation, no unbounded profiles fetch in Node.
CREATE OR REPLACE FUNCTION public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_role text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT id, 'broadcast', p_title, p_body
  FROM public.profiles
  WHERE p_role IS NULL OR role = p_role;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_send_broadcast(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
