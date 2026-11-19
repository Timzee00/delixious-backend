-- Production review reads use a stable keyset cursor ordered by
-- (created_at DESC, id DESC). These composite indexes match the filters
-- and order clauses used by GET /restaurants/:id/reviews and /reviews/mine.
-- Additive only: no customer review or order rows are changed.

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_created_id
  ON public.reviews (restaurant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_user_created_id
  ON public.reviews (user_id, created_at DESC, id DESC);
