-- ============================================================
-- Delixious - Security hardening
-- Run after the existing schema migrations.
-- ============================================================

-- Prevent privileged profile fields from being changed by ordinary
-- authenticated users. Backend/admin operations use the service role.
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_update_safe_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_suspended = (select p.is_suspended from public.profiles p where p.id = auth.uid())
    and rider_approval_status = (select p.rider_approval_status from public.profiles p where p.id = auth.uid())
    and rider_paystack_subaccount_code is not distinct from (select p.rider_paystack_subaccount_code from public.profiles p where p.id = auth.uid())
    and rider_bank_name is not distinct from (select p.rider_bank_name from public.profiles p where p.id = auth.uid())
    and rider_bank_account_number is not distinct from (select p.rider_bank_account_number from public.profiles p where p.id = auth.uid())
    and rider_bank_account_name is not distinct from (select p.rider_bank_account_name from public.profiles p where p.id = auth.uid())
    and rider_transfer_recipient_code is not distinct from (select p.rider_transfer_recipient_code from public.profiles p where p.id = auth.uid())
  );

-- The public signup trigger must never trust a client-supplied admin role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := new.raw_user_meta_data->>'role';

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    case
      when requested_role in ('restaurant_owner', 'delivery_agent') then requested_role
      else 'customer'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Payout processing is an internal state used to prevent concurrent transfers.
alter table public.orders drop constraint if exists orders_rider_payout_status_check;
alter table public.orders add constraint orders_rider_payout_status_check
  check (rider_payout_status in ('pending', 'processing', 'paid', 'failed'));

create unique index if not exists idx_orders_rider_payout_reference
  on public.orders(rider_payout_reference)
  where rider_payout_reference is not null;

-- Public restaurant discovery should expose only approved restaurants.
create index if not exists idx_restaurants_approval_name
  on public.restaurants(approval_status, name);
