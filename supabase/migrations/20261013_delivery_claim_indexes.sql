-- Stage only; first audit duplicate active rider assignments before applying.
-- A rider can have at most one active delivery; protects simultaneous claims.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_delivery_per_rider
 ON public.delivery_tracking(delivery_agent_id)
 WHERE delivery_agent_id IS NOT NULL AND status IN ('assigned','picked_up','en_route');
CREATE INDEX IF NOT EXISTS idx_available_delivery_queue
 ON public.delivery_tracking(updated_at ASC)
 WHERE delivery_agent_id IS NULL AND status = 'pending';
