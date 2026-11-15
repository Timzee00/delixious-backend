-- Multi-type food marketplace and public storefront foundation.
-- Additive migration: retains restaurant_id foreign keys and all existing order/cart records.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_types text[] NOT NULL DEFAULT ARRAY['restaurant']::text[],
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.restaurants
SET business_types = ARRAY['restaurant']::text[]
WHERE business_types IS NULL OR cardinality(business_types) = 0;

UPDATE public.restaurants
SET slug =
  COALESCE(
    NULLIF(
      trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
      ''
    ),
    'food-business'
  )
  || '-'
  || left(replace(id::text, '-', ''), 8)
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE public.restaurants
  ALTER COLUMN business_types SET DEFAULT ARRAY['restaurant']::text[],
  ALTER COLUMN business_types SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_business_types_valid,
  DROP CONSTRAINT IF EXISTS restaurants_slug_format;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_business_types_valid CHECK (
    cardinality(business_types) BETWEEN 1 AND 3
    AND business_types <@ ARRAY[
      'restaurant',
      'bakery',
      'cakes_desserts',
      'parfait_yogurt',
      'snacks_small_chops',
      'ice_cream_frozen',
      'drinks_beverages',
      'catering',
      'grocery_foods'
    ]::text[]
    AND (cardinality(business_types) < 2 OR business_types[1] <> business_types[2])
    AND (cardinality(business_types) < 3 OR business_types[1] <> business_types[3])
    AND (cardinality(business_types) < 3 OR business_types[2] <> business_types[3])
  ),
  ADD CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug_unique
  ON public.restaurants(slug);

CREATE INDEX IF NOT EXISTS idx_restaurants_business_types_gin
  ON public.restaurants USING gin(business_types)
  WHERE approval_status = 'approved';

-- One precomputed search document per product, indexed for fast store-level search.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(category, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_menu_items_storefront_feed
  ON public.menu_items(restaurant_id, created_at DESC, id ASC)
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_storefront_category
  ON public.menu_items(restaurant_id, category, created_at DESC, id ASC)
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_search_vector
  ON public.menu_items USING gin(search_vector);

-- Existing rows remain visible to the backend through the current service-role API.
-- No new public tables or direct browser write permissions are introduced.
