-- STAGING ONLY. Owner/admin privacy-safe aggregate repeat-purchase metrics.
-- Uses only genuinely delivered AND paid orders. Never returns identities.
CREATE INDEX IF NOT EXISTS idx_orders_repeat_analytics
  ON public.orders(user_id,created_at)
  WHERE status='delivered' AND payment_status='paid';

CREATE OR REPLACE FUNCTION public.get_retention_kpis_30d()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  WITH ordered AS (
    SELECT user_id,created_at,
      row_number() OVER (PARTITION BY user_id ORDER BY created_at,id) AS sequence
    FROM public.orders WHERE status='delivered' AND payment_status='paid'
  ),
  recent AS (
    SELECT * FROM ordered WHERE created_at>=now()-interval '30 days'
  ),
  totals AS (
    SELECT
      count(*) AS completed_orders_30d,
      count(*) FILTER(WHERE sequence>1) AS repeat_orders_30d,
      count(DISTINCT user_id) AS customers_30d,
      count(DISTINCT user_id) FILTER(WHERE sequence>1) AS returning_customers_30d
    FROM recent
  )
  SELECT jsonb_build_object(
    'window_days',30,
    'completed_orders',completed_orders_30d,
    'repeat_orders',repeat_orders_30d,
    'active_customers',customers_30d,
    'returning_customers',returning_customers_30d,
    'repeat_order_share_percent',
      CASE WHEN completed_orders_30d=0 THEN 0
        ELSE round(100.0*repeat_orders_30d/completed_orders_30d,1) END,
    'returning_customer_share_percent',
      CASE WHEN customers_30d=0 THEN 0
        ELSE round(100.0*returning_customers_30d/customers_30d,1) END
  ) FROM totals;
$$;
REVOKE ALL ON FUNCTION public.get_retention_kpis_30d() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_retention_kpis_30d() TO service_role;
