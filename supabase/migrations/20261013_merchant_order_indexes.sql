-- Non-destructive performance indexes for restaurant owner operations.
-- Execute on isolated staging and evaluate lock time/EXPLAIN before production.
CREATE INDEX IF NOT EXISTS idx_orders_merchant_paid_status
  ON public.orders (restaurant_id, status, created_at DESC)
  WHERE payment_status = 'paid';

CREATE INDEX IF NOT EXISTS idx_orders_merchant_paid_created
  ON public.orders (restaurant_id, created_at DESC)
  WHERE payment_status = 'paid';
