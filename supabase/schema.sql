-- ============================================================
-- Delixious - Production Database Schema (Supabase / Postgres)
-- Run this whole file in the Supabase SQL Editor once, on a
-- fresh project. Safe to re-run thanks to IF NOT EXISTS guards
-- on most objects (policies/triggers are dropped & recreated).
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Reusable: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PROFILES  (1:1 extension of auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer','restaurant_owner','delivery_agent','admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RESTAURANTS
-- ============================================================
create table if not exists public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cuisine_type text,
  address text,
  lat double precision,
  lng double precision,
  logo_url text,
  cover_image_url text,
  is_open boolean not null default true,
  rating_avg numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_restaurants_updated_at on public.restaurants;
create trigger trg_restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

create index if not exists idx_restaurants_owner on public.restaurants(owner_id);

-- ============================================================
-- MENU ITEMS
-- ============================================================
create table if not exists public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  category text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create index if not exists idx_menu_items_restaurant on public.menu_items(restaurant_id);

-- ============================================================
-- CARTS + CART ITEMS  (one active cart per user per restaurant)
-- ============================================================
create table if not exists public.carts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  special_instructions text,
  created_at timestamptz not null default now(),
  unique (cart_id, menu_item_id)
);

-- ============================================================
-- ORDERS + ORDER ITEMS
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  status text not null default 'pending' check (status in
    ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled')),
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  delivery_address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  payment_status text not null default 'pending' check (payment_status in
    ('pending','paid','failed','refunded')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_restaurant on public.orders(restaurant_id);
create index if not exists idx_orders_status on public.orders(status);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null,
  price_snapshot numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  subtotal numeric(10,2) not null
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'paystack',
  reference text not null unique,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments(order_id);

-- ============================================================
-- DELIVERY TRACKING
-- ============================================================
create table if not exists public.delivery_tracking (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade unique,
  delivery_agent_id uuid references public.profiles(id) on delete set null,
  current_lat double precision,
  current_lng double precision,
  status text not null default 'assigned' check (status in
    ('assigned','picked_up','en_route','delivered')),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_delivery_tracking_updated_at on public.delivery_tracking;
create trigger trg_delivery_tracking_updated_at before update on public.delivery_tracking
  for each row execute function public.set_updated_at();

-- ============================================================
-- REVIEWS
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_restaurant on public.reviews(restaurant_id);

-- Keep restaurant rating_avg/rating_count in sync automatically
create or replace function public.refresh_restaurant_rating()
returns trigger as $$
begin
  update public.restaurants r
  set rating_count = sub.cnt,
      rating_avg = sub.avg_rating
  from (
    select restaurant_id, count(*) as cnt, round(avg(rating)::numeric, 1) as avg_rating
    from public.reviews
    where restaurant_id = coalesce(new.restaurant_id, old.restaurant_id)
    group by restaurant_id
  ) sub
  where r.id = sub.restaurant_id;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reviews_refresh_rating on public.reviews;
create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_restaurant_rating();

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'general' check (type in
    ('general','order_update','payment','promo')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ============================================================
-- ROW LEVEL SECURITY
-- Backend uses the SERVICE ROLE key for all writes/business logic
-- (which bypasses RLS entirely), so these policies protect data
-- ONLY if the frontend ever queries Supabase directly with a
-- user's own JWT (e.g. realtime subscriptions, profile reads).
-- ============================================================
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read/update only their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Restaurants & menu items: public read (anyone can browse)
drop policy if exists "restaurants_public_read" on public.restaurants;
create policy "restaurants_public_read" on public.restaurants
  for select using (true);

drop policy if exists "menu_items_public_read" on public.menu_items;
create policy "menu_items_public_read" on public.menu_items
  for select using (true);

-- Carts / cart items: only the owning user
drop policy if exists "carts_own" on public.carts;
create policy "carts_own" on public.carts
  for all using (auth.uid() = user_id);

drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own" on public.cart_items
  for all using (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
  );

-- Orders: only the owning user can read their own orders
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Delivery tracking: visible to the order's owner
drop policy if exists "delivery_tracking_select_own" on public.delivery_tracking;
create policy "delivery_tracking_select_own" on public.delivery_tracking
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Reviews: public read, only owner can insert for their own order
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);

-- Notifications: only the owning user
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for all using (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- Lets the frontend subscribe directly to live location/status updates
-- on the order tracking page (see delixious-frontend). RLS above still
-- applies, so a customer only receives updates for their own orders.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_tracking'
  ) then
    alter publication supabase_realtime add table public.delivery_tracking;
  end if;
end $$;

-- ============================================================
-- Done. Next: fill your .env with the project URL + keys, then
-- run the backend (`npm install && npm run dev`).
-- ============================================================
