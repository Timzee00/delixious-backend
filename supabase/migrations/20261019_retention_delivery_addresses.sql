-- Staging migration: customer-owned saved delivery addresses.
CREATE TABLE IF NOT EXISTS public.customer_delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 50),
  address text NOT NULL CHECK (length(address) BETWEEN 5 AND 500),
  lat double precision CHECK(lat BETWEEN -90 AND 90),
  lng double precision CHECK(lng BETWEEN -180 AND 180),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user
  ON public.customer_delivery_addresses(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_one_default
  ON public.customer_delivery_addresses(user_id) WHERE is_default=true;
ALTER TABLE public.customer_delivery_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_delivery_addresses FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.set_customer_default_delivery_address(p_user uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=p_user FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.customer_delivery_addresses WHERE id=p_id AND user_id=p_user)
    THEN RAISE EXCEPTION 'ADDRESS_NOT_FOUND'; END IF;
  UPDATE public.customer_delivery_addresses SET is_default=false,updated_at=now()
    WHERE user_id=p_user AND is_default=true;
  UPDATE public.customer_delivery_addresses SET is_default=true,updated_at=now()
    WHERE id=p_id AND user_id=p_user;
END; $$;
REVOKE ALL ON FUNCTION public.set_customer_default_delivery_address(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_default_delivery_address(uuid,uuid) TO service_role;
