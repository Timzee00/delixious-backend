-- ============================================================
-- Delixious - Production consistency / schema parity hardening
--
-- This migration makes the live database resilient when the base
-- schema and earlier additive migrations were applied at different
-- times. It adds the fields used by the current API, restores the
-- expected RLS boundaries, and makes restaurant discovery expose
-- approved restaurants only.
--
-- Safe to run after the existing migrations and safe to re-run.
-- ============================================================

-- ---------- Profiles: fields used by current auth/admin/rider flows ----------
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists rider_approval_status text not null default 'pending';
alter table public.profiles add column if not exists rider_paystack_subaccount_code text;
alter table public.profiles add column if not exists rider_bank_name text;
alter table public.profiles add column if not exists rider_bank_account_number text;
alter table public.profiles add column if not exists rider_bank_account_name text;
alter table public.profiles add column if not exists rider_rating_avg numeric(2,1) not null default 0;
alter table public.profiles add column if not exists rider_rating_count integer not null default 0;
alter table public.profiles add column if not exists rider_transfer_recipient_code text;

alter table public.profiles drop constraint if exists profiles_rider_approval_status_check;
alter table public.profiles add constraint profiles_rider_approval_status_check
  check (rider_approval_status in ('pending', 'approved', 'rejected'));

-- ---------- Restaurants: approval and payout fields ----------
alter table public.restaurants add column if not exists approval_status text not null default 'pending';
alter table public.restaurants add column if not exists paystack_subaccount_code text;
alter table public.restaurants add column if not exists bank_name text;
alter table public.restaurants add column if not exists bank_account_number text;
alter table public.restaurants add column if not exists bank_account_name text;

alter table public.restaurants drop constraint if exists restaurants_approval_status_check;
alter table public.restaurants add constraint restaurants_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

-- ---------- Orders: current checkout, discount and payout state ----------
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists platform_commission numeric(10,2) not null default 0;
alter table public.orders add column if not exists rider_payout_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists checkout_group_id uuid;
alter table public.orders add column if not exists rider_payout_status text not null default 'pending';
alter table public.orders add column if not exists rider_payout_reference text;

alter table public.orders drop constraint if exists orders_rider_payout_status_check;
alter table public.orders add constraint orders_rider_payout_status_check
  check (rider_payout_status in ('pending', 'processing', 'paid', 'failed'));

-- ---------- Payments: idempotent checkout/webhook processing ----------
alter table public.payments add column if not exists checkout_group_id uuid;
alter table public.payments alter column order_id drop not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'processing', 'success', 'failed'));

-- ---------- Delivery tracking: claimable rider state ----------
alter table public.delivery_tracking add column if not exists claimed_at timestamptz;
alter table public.delivery_tracking drop constraint if exists delivery_tracking_status_check;
alter table public.delivery_tracking add constraint delivery_tracking_status_check
  check (status in ('pending', 'assigned', 'picked_up', 'en_route', 'delivered'));
alter table public.delivery_tracking alter column status set default 'pending';

-- ---------- Notifications: admin broadcast ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('general', 'order_update', 'payment', 'promo', 'broadcast'));

-- ---------- Supporting tables used by the current frontend ----------
create table if not exists public.restaurant_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index if not exists idx_restaurant_favorites_user
  on public.restaurant_favorites(user_id, created_at desc);
create index if not exists idx_restaurant_favorites_restaurant
  on public.restaurant_favorites(restaurant_id);

alter table public.restaurant_favorites enable row level security;
drop policy if exists "restaurant_favorites_own" on public.restaurant_favorites;
create policy "restaurant_favorites_own" on public.restaurant_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.rider_reviews (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id)
);

create index if not exists idx_rider_reviews_rider on public.rider_reviews(rider_id);
alter table public.rider_reviews enable row level security;
drop policy if exists "rider_reviews_public_read" on public.rider_reviews;
create policy "rider_reviews_public_read" on public.rider_reviews
  for select using (true);
drop policy if exists "rider_reviews_insert_own" on public.rider_reviews;
create policy "rider_reviews_insert_own" on public.rider_reviews
  for insert with check (auth.uid() = reviewer_id);

create table if not exists public.coupons (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'flat')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  scope text not null check (scope in ('restaurant', 'menu_item')),
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  check ((scope = 'menu_item' and menu_item_id is not null) or (scope = 'restaurant' and menu_item_id is null))
);

create index if not exists idx_coupons_restaurant on public.coupons(restaurant_id);
alter table public.coupons enable row level security;
drop policy if exists "coupons_public_read_active" on public.coupons;
create policy "coupons_public_read_active" on public.coupons
  for select using (is_active = true);

-- ---------- Correct public discovery boundary ----------
-- The API uses the service role for server-side restaurant management,
-- while direct browser reads should never expose pending/rejected venues.
drop policy if exists "restaurants_public_read" on public.restaurants;
create policy "restaurants_public_read" on public.restaurants
  for select using (approval_status = 'approved');

drop policy if exists "menu_items_public_read" on public.menu_items;
create policy "menu_items_public_read" on public.menu_items
  for select using (
    exists (
      select 1
      from public.restaurants r
      where r.id = restaurant_id
        and r.approval_status = 'approved'
    )
  );

-- ---------- Indexes ----------
create index if not exists idx_profiles_suspended on public.profiles(is_suspended);
create index if not exists idx_profiles_role_approval on public.profiles(role, rider_approval_status);
create index if not exists idx_restaurants_approval_name on public.restaurants(approval_status, name);
create index if not exists idx_orders_checkout_group on public.orders(checkout_group_id);
create index if not exists idx_payments_checkout_group on public.payments(checkout_group_id);
create unique index if not exists idx_orders_rider_payout_reference
  on public.orders(rider_payout_reference)
  where rider_payout_reference is not null;

-- ---------- Admin stats view ----------
create or replace view public.admin_stats as
select
  (select count(*) from public.restaurants) as total_restaurants,
  (select count(*) from public.restaurants where approval_status = 'pending') as pending_restaurants,
  (select count(*) from public.profiles where role = 'delivery_agent') as total_riders,
  (select count(*) from public.profiles where role = 'delivery_agent' and rider_approval_status = 'pending') as pending_riders,
  (select count(*) from public.profiles where role = 'customer') as total_customers,
  (select count(*) from public.orders) as total_orders,
  (select coalesce(sum(total_amount), 0) from public.orders where status <> 'cancelled') as total_revenue,
  (select coalesce(sum(platform_commission), 0) from public.orders where status <> 'cancelled') as total_commission;

-- ============================================================
-- Done.
-- ============================================================
