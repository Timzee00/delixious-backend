# Delixious ↔ Brevo transactional email integration (STAGING ONLY)

**Status: code committed, not tested with a connected Brevo account. No provider key configured or production migration run.**

## What is actually supported

- Delixious staff invitation email, with a one-time URL encrypted in storage.
- Restaurant owner email on job application; optional applicant acknowledgment OFF by default.
- Customer payment-received notice, restaurant owner new paid-order alert, customer restaurant-accepted and delivery-assigned emails.
- Escaped branded responsive HTML and plain-text templates; transactional only, no marketing mailing list.
- PostgreSQL outbox for persistence and unique event idempotency keys.
- Multi-worker-safe `claim_email_outbox` uses `FOR UPDATE SKIP LOCKED`; process polling runs only when enabled.
- Brevo `POST /v3/smtp/email` with API key, verified sender, message ID and non-PII tags.
- Retry on definite HTTP 429 with backoff; any ambiguous timeout/provider 5xx goes into **uncertain** quarantine for manual reconciliation (never blindly duplicate).
- Authenticated Brevo delivery-event webhook and Site HQ counts (admin-only, no recipient addresses or email content).
- All email sender credentials, encryption key and callback token are **server-side environment variables only**.

## Security and data ownership

The email queue holds recipient emails in plaintext as required for delivery, but encrypts sensitive template data (including staff tokens) with AES-256-GCM and stores no provider API key. Protect backups and rotate keys through a planned drain/re-encryption; deleting a key makes queued content unreadable. Never log email payloads, bank information or invitation URLs. Define retention for applicant and email outbox personal data before release.

Only transactional account/order/hiring mail is implemented. **Brevo marketing lists, newsletter subscriptions, promotional campaigns, WhatsApp and SMS are not connected.** Build consent and opt-out workflows separately before any marketing sends. Supabase Auth still owns signup/verification/password-reset messages until Supabase custom SMTP is configured explicitly; this code does not silently take over Supabase Auth email.

## Staging setup checklist (do not run against production)

1. Create/use an **isolated staging** Supabase environment; prepare the prior backend PR migrations and `20261013_brevo_email_outbox.sql`. Backup and review schema before any migration.
2. Register and verify the desired sender/domain inside Brevo. Configure authenticated SPF, DKIM and DMARC; use a staging-compatible sender and a restricted Brevo API key.
3. Set backend staging `FRONTEND_URL` to the **matching staging frontend domain**, NOT the pinned production domain. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `EMAIL_ENCRYPTION_KEY`, `BREVO_WEBHOOK_TOKEN` via the service secret manager. Do not paste them into GitHub, client code or chats.
4. Set `BREVO_ENABLED=true`, keep `BREVO_WORKER_ENABLED=false` until migrations, tests and recipient allowlists are checked. On staging, use only controlled test recipient emails.
5. In Brevo transactional webhook settings, add `https://<staging-backend>/api/email/webhook` with bearer-token authorization, and subscribe to delivered, deferred, hard bounce, soft bounce, blocked, invalid email and error events. Require HTTPS and test a wrong token is rejected.
6. Enable `BREVO_WORKER_ENABLED=true` **only** after staging verified. Poll interval is 30 seconds with at most three jobs per claim. The current in-process worker stops when the free hosting process sleeps. For an enterprise launch deploy a dedicated always-on background worker (no multiple uncoordinated scheduler instances), queue alarms and staff on-call/incident playbook.
7. Open **Site HQ → Email Delivery**, check queue counts and make controlled test applications/invites/orders.
8. Check actual accepted `messageId`, delivered webhook, bounce and rejected keys. Ensure duplicate webhooks do not duplicate dispatch, and uncertain messages are never auto-resent.
9. Validate HTML escaping, mobile email clients, Gmail/Outlook/other mailbox spam-folder delivery, sender alignment and reputation.
10. Configure a scheduled data-retention job and documented recipient complaint handling before collecting real applicant data.

## Required acceptance tests

- Wrong/missing Brevo token -> 401; legitimate callback can update **only** its known email message and recipient.
- A wrong or expired staff link cannot grant access; sending email and accepting an invite are independent.
- One paid order produces one customer receipt and one owner alert even if payment webhook retries.
- Email transport failure cannot undo payment, order status, staff invite or job application.
- Email outbox lease expiry moves to *uncertain*; no unsafe automatic resend.
- Rate limit 429 backs off; 401/403/400 are classified as failed; unknown network responses need reconciliation.
- No secret or customer address leaks to frontend, logs, or Site HQ email operations.
- Sender/domain verification and Bearer-authenticated webhook are configured **in Brevo itself**.
- CI/build/test suite green, controlled recipient inbox confirmation and rollback review.

## API references

- Send API: https://developers.brevo.com/docs/send-a-transactional-email
- Transactional events: https://developers.brevo.com/docs/transactional-webhooks
- Secured Brevo webhooks: https://developers.brevo.com/docs/secured-webhooks
- Rate limits: https://developers.brevo.com/docs/api-limits

## Rollout notes

- With `BREVO_ENABLED=false`, the system queues **nothing**, sends **nothing**, and staff invitations still return a private shareable link to the restaurant owner.
- With `BREVO_ENABLED=true` and worker disabled, application events queue but do not send until enabled.
- If staging is asleep, the in-process worker won't deliver until the process resumes. A dedicated always-on worker is required for strong time-based SLAs.
- Do not advertise guaranteed delivery merely because Brevo accepted an email API request.
