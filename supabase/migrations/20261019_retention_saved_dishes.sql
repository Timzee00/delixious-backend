-- Staging only: private saved-dish bookmarks. Never expose a customer's
-- taste history to another user or restaurant owner.
CREATE TABLE IF NOT EXISTS public.menu_item_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, menu_item_id)
);
CREATE INDEX IF NOT EXISTS idx_menu_item_favorites_user_created
  ON public.menu_item_favorites(user_id,created_at DESC);
ALTER TABLE public.menu_item_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menu_item_favorites FROM anon,authenticated;
-- Service-role API enforces the caller's identity.
