# Delixious — Rider dispatch, restaurant teams, careers and social sharing

Status: **Development implementation; NOT staging-certified or production-deployed.**

## Operational flow

1. Customer checks out, pays. An order and pending delivery-tracking record already exist. A successful payment sets `payment_status=paid` but **does not** auto-accept the restaurant order.
2. Restaurant receives the order in its owner queue or authorized counter/kitchen staff queue.
3. An owner or authorized counter **explicitly confirms** the paid order; kitchen then starts preparing food.
4. Approved rider opens **Rider Dashboard → Available Jobs**. Server returns a paginated queue of paid, confirmed/preparing orders with restaurant pickup address and rider payout only. Customer exact address is **not** public.
5. Rider claims job with conditional database update; manual restaurant assignment uses the same compare-and-set protection. Partial unique index forbids multiple simultaneous active deliveries for a rider.
6. Customer and restaurant owner are notified of the claim; rider sees private drop-off address under **My Deliveries**.
7. Rider marks pickup only when the paid order is preparing; rider then marks en route.
8. On arrival, customer reads a private six-digit handoff code in the order page. Rider enters it to complete delivery. Five failed attempts lock that order pending manual support. Code is HMAC-derived from a server-only 32+ character `DELIVERY_HANDOFF_SECRET`.
9. Transfer initiation leaves rider payout in `processing`. Only Paystack HMAC-verified `transfer.success`, `transfer.failed` or `transfer.reversed` events update the outcome, with amount/reference/order checks. Settlement retries, provider polling and financial-ledger reconciliation still require a review before production.

## Staff, onboarding and least privilege

Owner → Team → Invite employee email → role (manager/kitchen/counter) → private 7-day invitation URL → staff signs up/logs in to their own Delixious account → confirms matching email → accepts URL.

Invitation hashes are stored; transactional `accept_restaurant_staff_invite` RPC atomically consumes the token and upserts membership. Revocation prevents future staff API access.

| Actor | Current delegated permissions |
| --- | --- |
| Owner | Existing owner dashboard; team invites, staff access, vacancies, applicants |
| Manager | Read paid restaurant orders, confirm/start preparing; change menu availability |
| Kitchen | Read paid restaurant orders, start preparing confirmed orders; change menu availability |
| Counter | Read paid restaurant orders; confirm paid pending orders |
| Rider | See limited paid delivery offers, claim, update own assigned delivery with handoff verification |
| Applicant | Read public vacancy, submit validated consented application; **no staff access** |

Staff does **not** receive the owner's bank details, payout settings, global admin role, prices editor or account-management privileges.

## Branded careers and sharing

Restaurant Dashboard → Hiring → Publish vacancy (title, location, employment type, description), view applicants, shortlist/reject, invite shortlisted person via Team.

Public route `/restaurants/:id/careers`; applicant name, email, optional phone, cover note and privacy consent. Staff access is granted separately by invitation, never automatically by applying.

Social previews are dynamic HTML routes (not generic React SPA): `/share/restaurants/:id`, `/share/careers/:id`, `/share/jobs/:id`. Netlify `_redirects` and `netlify.toml` proxy these routes to the matching backend. When deploying preview/staging, ensure `FRONTEND_URL` matches that environment, and run WhatsApp/Facebook/X link-debugger tests.

## Database migrations required in isolated staging

- `20261013_restaurant_staff_and_careers.sql`
- `20261013_delivery_claim_indexes.sql`
- `20261013_delivery_proof.sql`
- All earlier merchant/payout, admin moderation and operating-hours migrations from backend PR.

No migration has been applied to production. Audit existing active rider assignments before attempting the unique index. Provision `DELIVERY_HANDOFF_SECRET` only in the backend's secure staging environment.

## Blocking release tests

- CI frontend build and backend Vitest both green; all import paths/routes load.
- One restaurant owner invites staff; verified recipient accepts; a mismatched account cannot accept.
- Invite reuse/concurrent acceptance and revocation tested.
- Payment success leaves order awaiting restaurant acceptance; only confirmed/preparing orders appear to riders.
- Two riders concurrently claim the same order; exactly one succeeds. Same rider cannot actively claim two jobs.
- Owner manual assignment cannot override an existing rider.
- Unapproved rider gets 403 for available jobs.
- Unclaimed delivery feed exposes **no** customer full address, phone, or order total.
- Counter/kitchen/manager permission boundaries tested against an unrelated restaurant and unauthorized edits.
- Rider pickup blocked if kitchen hasn't started preparing.
- Paid or pending-payment orders cannot be silently cancelled without the refund/reconciliation workflow.
- Delivery completion blocked without the correct customer code; incorrect attempts lock after five.
- A successful Paystack HTTP transfer initialization **does not** set `rider_payout_status=paid`; signed transfer success does. Test reversed/failed/mismatched amount webhooks, duplicate callbacks and webhook arriving before provider HTTP reply.
- Published/unpublished career jobs respected; unapproved restaurant careers return 404; applications respect consent and rate limit.
- Branded restaurant, careers and vacancy share URLs return correct Open Graph tags to actual crawlers.
- All social links show correct host for staging and eventual production (no live/preview mixing).
- Privacy retention/deletion process for applicant records, notification reliability and payment reconciliations reviewed.
- Slow-network Android usability, pagination, accessibility, rollback and deployment checks all documented.

## Features NOT YET implemented / NOT guaranteed

Geospatial dispatch zones, accurate ETA and map routing, background jobs for matching, rider GPS privacy/consent policy, dynamic delivery acceptance timers, rider offline-online availability scheduling, two-sided chat, restaurant shift scheduler, automatic Brevo invitations, candidate CV uploads, interview scheduling, retention automation, staff payroll, fraud scoring, distributed load tests and final payout settlement reconciliation. These should be separate reviewed workstreams.

## Current CI diagnostic blocker

GitHub Actions reports failures for frontend build/backend tests, but the connected GitHub job-log reader returned GitHub BlobNotFound for the underlying logs. Do not infer test outcomes from the unavailable logs, and do not rerun GitHub Actions when the owner's billing restrictions prevent it. Run equivalent build and Vitest steps in a controlled local/staging environment and preserve the output before requesting review.
