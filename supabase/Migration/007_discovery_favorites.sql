-- Delixious discovery + restaurant favorites
-- Adds the customer favorite relationship used to personalize the home feed.

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
