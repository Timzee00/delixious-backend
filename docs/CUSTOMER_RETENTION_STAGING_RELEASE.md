# Delixious — Returning-customer retention upgrade

**Status:** Development PR only. **Do not merge, deploy production, or apply these migrations to the live database.**

## User-facing capabilities

1. **Order Again (only delivered + paid)**: an authenticated preview compares historic dish snapshots with current catalogue names, prices, availability, quantities and restaurant approval. Customer explicitly confirms that the whole existing cart will be replaced. A single PostgreSQL transaction restores only still-available dishes, returns skipped dishes, and uses current prices. Zero available dishes, an unapproved/closed restaurant or someone else's order is rejected. Checkout still validates again.
2. **Cart persistence through Paystack**: payment initialization leaves the cart in place. Once a payment is verified successful, the database cleanup removes only a cart whose current item IDs and quantities still exactly match purchased items. Customer edits or abandoned payments must never erase food.
3. **Saved dishes**: each user can bookmark individual dishes (private service-role-backed table), return to them from the home shelf and Favorites → Saved dishes. Restaurant bookmarks continue to work as before. Saved items may become unavailable; saved status isn't a guarantee of stock or online payment readiness.
4. **Saved addresses**: opt-in saving of up to 10 labeled addresses, user-scoped reads, deletion, single default and coordinate pair validation. Checkout lets a customer select a saved address and clears stale coordinates when the typed text is changed. Never send addresses to other users.
5. **Food journey**: badges represent only *paid and delivered* order counts; no points balance, stored-value liability, discounts or monetary redemptions.
6. **Communication preferences**: owner-scoped preferences store optional order-email opt-out, future promotional email consent timestamp. Marketing sending is still disabled; the preference records permission only. In-app order status remains enabled regardless of optional email. Brevo's queue checks customer preferences before optional order emails are enqueued.
7. **Site HQ retention insights**: admin-only aggregate trailing 30-day counts of paid/delivered completed orders, repeat orders and repeat customers; no user IDs or emails in the response. `repeat` means a completed order has at least one earlier completed paid order, including prior to the reporting window.

## Non-destructive staged migrations (review order)

- `supabase/migrations/20261019_retention_reorder_cart.sql`
- `supabase/migrations/20261019_retention_safe_cart_cleanup.sql`
- `supabase/migrations/20261019_retention_saved_dishes.sql`
- `supabase/migrations/20261019_retention_delivery_addresses.sql`
- `supabase/migrations/20261019_retention_email_preferences.sql`
- `supabase/migrations/20261019_retention_metrics.sql`

These require all previous admin/merchant/dispatch/email migrations in the other release checklists.

## Staging acceptance tests (mandatory)

- Build Vite and run Vitest; confirm checkout page compiles after removing the stray closing brace.
- Customers cannot reorder an order that belongs to someone else, is unpaid, failed, pending or cancelled.
- Two identical reorder attempts cannot corrupt cart; old restaurant cart is never replaced without explicit confirmation.
- Removing a menu item/suspending approval/closing a restaurant between preview and restore is handled safely; previously saved cart remains if restoration fails. Current prices, not old prices, are used.
- A modified cart survives verified payment. Unmodified purchased cart gets cleaned up exactly once. A customer who closes Paystack without paying keeps their cart.
- Saved-dish listing and IDs are user-scoped; bookmarking unapproved restaurant items is rejected. Removed dishes must not crash the Favorites page.
- Address saves, defaults, deletions and coordinate validation never cross user boundaries. Editing an address must invalidate previously selected GPS coordinates.
- Food journey count excludes pending, unconfirmed, refunded or cancelled orders; badges make no cash promise.
- Marketing opt-in defaults OFF and can be withdrawn; optional order email opt-out prevents enqueue while customer in-app order tracking continues.
- Admin retention counts include only genuinely paid+delivered orders, with first-time vs repeat definition verified against synthetic data.
- Verify P95 checkout latency and ensure regression from cold Render backend does not create duplicate charges.
- Privacy review: saved coordinates and purchase histories are sensitive; define retention/export/delete policy and access audits before release.
- All production credentials, real customers and payments are excluded from staging testing.

## Current blocker

The read-only Supabase connection reported password authentication failure while querying the existing live DB, so the current schema was verified against repository SQL instead of live migrations. **No database migrations have been applied.** Production remains pinned to its earlier deploy. Existing GitHub Actions failures/billing limitations still prevent claiming a green complete build. Only standalone backend syntax checks were possible, not end-to-end acceptance tests.

## Retention measurement philosophy

Do not promise acquisition-level scale or improved retention without evidence. Establish a baseline on staging and (after separately approved release) live metrics. Evaluate week-1/4 repeat purchases, abandoned checkout, favourite saves, reorder starts vs completed purchases, time-to-repeat, subscription consent, rider delivery reliability and restaurant acceptance time. Consent and safe payments matter more than push-message volume.
