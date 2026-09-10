-- ============================================================
-- Delixious - Phase 3 Security Hardening
--
-- Goals:
--  1. Never allow public signup to create an admin profile.
--  2. Prevent a normal authenticated user from changing their own
--     role, suspension state, approval state, or payout controls.
--  3. Keep service-role backend/admin operations unrestricted.
--
-- Safe to run on the existing production database.
-- ============================================================

-- The profile trigger is defense-in-depth for direct Supabase Auth
-- signups that bypass the Express API.
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
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New User'),
    new.raw_user_meta_data->>'phone',
    case
      when requested_role in ('restaurant_owner', 'delivery_agent') then requested_role
      else 'customer'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Protect privileged profile fields even if the client talks directly
-- to Supabase with its own JWT. The backend uses the service_role key,
-- so legitimate admin/server-side changes remain possible.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your account role.' using errcode = '42501';
    end if;

    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'You cannot change your account suspension status.' using errcode = '42501';
    end if;

    if new.rider_approval_status is distinct from old.rider_approval_status then
      raise exception 'You cannot change rider approval status.' using errcode = '42501';
    end if;

    if new.rider_paystack_subaccount_code is distinct from old.rider_paystack_subaccount_code
       or new.rider_transfer_recipient_code is distinct from old.rider_transfer_recipient_code
       or new.rider_bank_name is distinct from old.rider_bank_name
       or new.rider_bank_account_number is distinct from old.rider_bank_account_number
       or new.rider_bank_account_name is distinct from old.rider_bank_account_name then
      raise exception 'You cannot change protected payout fields.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_fields on public.profiles;
create trigger trg_protect_profile_privileged_fields
before update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

-- Explicitly remove any ability for an authenticated browser client to
-- write privileged fields through the profile-own update policy. The
-- trigger above is the final guard, while this policy documents the
-- intended ownership boundary.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

-- Helpful indexes for the server-side suspension/approval checks.
create index if not exists idx_profiles_suspended on public.profiles(is_suspended);
create index if not exists idx_profiles_role_approval on public.profiles(role, rider_approval_status);

-- ============================================================
-- Done.
-- ============================================================
