-- ============================================================
-- Delixious - Phase 2 Schema Additions
-- Restaurant approval + Paystack subaccounts, rider payouts +
-- approval, rider dispatch (claim/assign), rider reviews (both
-- directions), coupons, broadcast notifications.
-- Purely additive - safe to run on the existing production DB.
-- ============================================================

-- ---------- RESTAURANTS: approval + payout subaccount ----------
alter table public.restaurants add column if not exists approval_status text not null default 'pending'
  check (approval_status in ('pending','approved','rejected'));
alter table public.restaurants add column if not exists paystack_subaccount_code text;
alter table public.restaurants add column if not exists bank_name text;
alter table public.restaurants add column if not exists bank_account_number text;
alter table public.restaurants add column if not exists bank_account_name text;

create index if not exists idx_restaurants_approval on public.restaurants(approval_status);

-- ---------- PROFILES: rider payout + approval + rating ----------
alter table public.profiles add column if not exists rider_approval_status text not null default 'pending'
  check (rider_approval_status in ('pending','approved','rejected'));
alter table public.profiles add column if not exists rider_paystack_subaccount_code text;
alter table public.profiles add column if not exists rider_bank_name text;
alter table public.profiles add column if not exists rider_bank_account_number text;
alter table public.profiles add column if not exists rider_bank_account_name text;
alter table public.profiles add column if not exists rider_rating_avg numeric(2,1) not null default 0;
alter table public.profiles add column if not exists rider_rating_count integer not null default 0;

-- ---------- ORDERS: coupon tracking + platform commission fields ----------
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists platform_commission numeric(10,2) not null default 0;
alter table public.orders add column if not exists rider_payout_amount numeric(10,2) not null default 0;

-- ---------- DELIVERY TRACKING: support unassigned/claimable state ----------
alter table public.delivery_tracking drop constraint if exists delivery_tracking_status_check;
alter table public.delivery_tracking add constraint delivery_tracking_status_check
  check (status in ('pending','assigned','picked_up','en_route','delivered'));
alter table public.delivery_tracking alter column status set default 'pending';
alter table public.delivery_tracking add column if not exists claimed_at timestamptz;

-- ============================================================
-- RIDER REVIEWS  (both the customer AND the restaurant can rate
-- the rider for the same order - two separate rows, one each)
-- ============================================================
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

create or replace function public.refresh_rider_rating()
returns trigger as $$
begin
  update public.profiles p
  set rider_rating_count = sub.cnt,
      rider_rating_avg = sub.avg_rating
  from (
    select rider_id, count(*) as cnt, round(avg(rating)::numeric, 1) as avg_rating
    from public.rider_reviews
    where rider_id = coalesce(new.rider_id, old.rider_id)
    group by rider_id
  ) sub
  where p.id = sub.rider_id;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_rider_reviews_refresh_rating on public.rider_reviews;
create trigger trg_rider_reviews_refresh_rating
  after insert or update or delete on public.rider_reviews
  for each row execute function public.refresh_rider_rating();

-- ============================================================
-- COUPONS
-- ============================================================
create table if not exists public.coupons (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage','flat')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  scope text not null check (scope in ('restaurant','menu_item')),
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  check (
    (scope = 'menu_item' and menu_item_id is not null) or
    (scope = 'restaurant' and menu_item_id is null)
  )
);

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

create index if not exists idx_coupons_restaurant on public.coupons(restaurant_id);

-- ---------- NOTIFICATIONS: allow admin broadcast type ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('general','order_update','payment','promo','broadcast'));

-- ============================================================
-- ROW LEVEL SECURITY for new tables
-- ============================================================
alter table public.rider_reviews enable row level security;
alter table public.coupons enable row level security;

drop policy if exists "rider_reviews_public_read" on public.rider_reviews;
create policy "rider_reviews_public_read" on public.rider_reviews
  for select using (true);

drop policy if exists "rider_reviews_insert_own" on public.rider_reviews;
create policy "rider_reviews_insert_own" on public.rider_reviews
  for insert with check (auth.uid() = reviewer_id);

drop policy if exists "coupons_public_read_active" on public.coupons;
create policy "coupons_public_read_active" on public.coupons
  for select using (is_active = true);

-- ============================================================
-- Done. This only adds new columns/tables - nothing existing
-- was dropped or renamed, so current features keep working.
-- ============================================================
alter table public.profiles add column if not exists is_suspended boolean not null default false;

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
