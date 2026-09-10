-- ============================================================
-- Delixious - Security hardening
-- Run after the existing schema migrations.
-- ============================================================

-- Ordinary users may update their own profile, but protected fields
-- are enforced by a BEFORE UPDATE trigger. The backend uses the service
-- role and therefore is not blocked by this trigger.
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_safe_self" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.prevent_self_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is populated for normal Supabase authenticated requests.
  -- Service-role/backend operations do not run as the user's auth identity.
  if auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.is_suspended is distinct from old.is_suspended
      or new.rider_approval_status is distinct from old.rider_approval_status
      or new.rider_paystack_subaccount_code is distinct from old.rider_paystack_subaccount_code
      or new.rider_bank_name is distinct from old.rider_bank_name
      or new.rider_bank_account_number is distinct from old.rider_bank_account_number
      or new.rider_bank_account_name is distinct from old.rider_bank_account_name
      or new.rider_transfer_recipient_code is distinct from old.rider_transfer_recipient_code
    then
      raise exception 'Protected profile fields cannot be changed by the account owner.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_changes on public.profiles;
create trigger trg_prevent_self_privilege_changes
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_changes();

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
