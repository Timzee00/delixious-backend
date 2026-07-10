# Delixious Backend

Multi-restaurant food ordering platform API. Node.js/Express + Supabase
(Postgres, Auth, Storage, Realtime) + Paystack. Every feature from the
original spec is implemented, and the whole thing has been through a
production-readiness pass: cookie-based auth with refresh tokens, CSRF
protection, request validation, image optimization, structured logging,
automated tests, and OpenAPI docs.

## 1. Set up Supabase

1. Create a free project at https://supabase.com
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**.
   This creates every table, trigger, RLS policy, and the Realtime publication
   for live delivery tracking.
3. Go to **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose this)
4. Go to **Storage** → **New bucket** → name it exactly `delixious-media` → toggle
   **Public bucket** ON → **Create bucket**.

## 2. Set up Paystack

1. Create an account at https://paystack.com
2. Go to **Settings → API Keys & Webhooks** and copy your secret/public keys into `.env`.
3. Set your webhook URL to `https://your-deployed-backend/api/payments/webhook`
   once deployed (see the ngrok note further down for local testing).

## 3. Local setup

```bash
cp .env.example .env
# fill in the values from steps 1-2 above
npm install
npm run dev
```

Server runs at `http://localhost:5000`. Check `GET /health`. Full interactive
API docs (Swagger UI) are at `http://localhost:5000/api/docs`.

```bash
npm test
```

Runs the automated test suite (28 tests: validation schemas, CSRF middleware,
and integration tests against the real Express app - some with a mocked
Supabase client so they run without any real credentials or network access).

## 4. Authentication architecture

Auth moved from "JWT in localStorage, sent as a Bearer header" to **httpOnly
cookies**, which is meaningfully more secure: a token in localStorage is
readable by any JavaScript that runs on the page (e.g. via an XSS bug in a
dependency), while an httpOnly cookie simply cannot be read by JS at all.

On `/auth/login`, `/auth/signup`, or `/auth/refresh`, the server sets three cookies:

| Cookie | httpOnly | Path | Purpose |
|---|---|---|---|
| `access_token` | Yes | `/` | Sent automatically on every API request; short-lived (matches Supabase's `expires_in`, ~1 hour) |
| `refresh_token` | Yes | `/api/auth` only | Used only to obtain a new access token; long-lived |
| `csrf_token` | **No** | `/` | Frontend JS reads this and echoes it back as a header (see CSRF below) |

**Token expiration handling**: when `access_token` expires, `requireAuth`
responds `401` with `code: "TOKEN_EXPIRED"` (as opposed to `"NO_SESSION"` when
there's no token at all). The frontend's axios interceptor watches for that
code, calls `POST /auth/refresh` once, and retries the original request -
transparent to the user, no forced re-login every hour.

**CSRF protection** (double-submit cookie pattern): since auth now rides on
cookies, the browser will attach them to *any* request to this API - including
ones triggered by a malicious third-party page. To prevent that, every
non-GET request must include an `X-CSRF-Token` header matching the
`csrf_token` cookie's value. A cross-site attacker can make the browser send
the cookie automatically, but can't read its value from JS to also set the
matching header (that's the whole trick). Login/signup are exempt (no session
yet to protect); the Paystack webhook is exempt too (it's protected by
signature verification instead, and Paystack can't send custom headers or
read your cookies anyway).

**Stronger auth security**:
- A dedicated rate limiter on `/auth/login` and `/auth/signup` (10 attempts /
  15 min per IP) on top of the general API limiter, to slow down brute-forcing.
- Login always returns the same generic "Invalid email or password" message -
  never reveals whether an email is registered.
- Passwords require 8+ characters (enforced by request validation, not just
  Supabase's own check).

## 5. Request validation

Every route validates its body/query against a [zod](https://zod.dev) schema
(`src/schemas/*.schema.js`) via a small middleware (`src/middleware/validate.js`)
before the controller ever runs. Invalid requests get a `400` with a list of
specific field errors, e.g.:

```json
{ "error": "Invalid request.", "issues": [{ "field": "password", "message": "Password must be at least 8 characters." }] }
```

This replaced ~50 scattered manual `if (!field) return res.status(400)...`
checks that used to live inside controllers - validation is now declarative,
consistent, and in one place per resource.

## 6. API endpoints

**Auth**

| Method | Route              | Auth | Description                     |
|--------|--------------------|:----:|----------------------------------|
| POST   | /api/auth/signup   | No   | Create account (customer/owner/agent) |
| POST   | /api/auth/login    | No   | Log in - sets auth cookies      |
| POST   | /api/auth/refresh  | No*  | Exchange refresh_token cookie for a new access token (*needs a valid CSRF token) |
| POST   | /api/auth/logout   | No*  | Clear auth cookies (*needs a valid CSRF token) |
| GET    | /api/auth/me       | Yes  | Get current user + profile      |
| PUT    | /api/auth/profile  | Yes  | Update full_name/phone/avatar_url |

**Restaurants**

| Method | Route                              | Auth                    | Description                        |
|--------|---------------------------------------|--------------------------|--------------------------------------|
| GET    | /api/restaurants                       | No                       | Browse/search (`?search=&cuisine=&is_open=&page=&limit=`) |
| GET    | /api/restaurants/mine                   | Yes (owner/admin)       | List restaurants you own            |
| GET    | /api/restaurants/:id                    | No                       | Restaurant detail                   |
| GET    | /api/restaurants/:id/menu               | No                       | Menu items, grouped by category     |
| GET    | /api/restaurants/:id/reviews            | No                       | Paginated public reviews            |
| GET    | /api/restaurants/:id/orders             | Yes (must own)          | Incoming order queue (paginated)    |
| POST   | /api/restaurants                        | Yes (owner/admin)       | Create a restaurant                 |
| PUT    | /api/restaurants/:id                    | Yes (must own)          | Update restaurant details           |
| PATCH  | /api/restaurants/:id/toggle-open        | Yes (must own)          | Open/close the restaurant           |
| DELETE | /api/restaurants/:id                    | Yes (must own)          | Delete restaurant                   |
| POST   | /api/restaurants/:id/menu               | Yes (must own)          | Add a menu item                     |

**Menu items**

| Method | Route                                       | Auth           | Description              |
|--------|-----------------------------------------------|----------------|----------------------------|
| PUT    | /api/menu-items/:id                            | Yes (must own) | Update a menu item        |
| PATCH  | /api/menu-items/:id/toggle-availability        | Yes (must own) | Mark in/out of stock      |
| DELETE | /api/menu-items/:id                            | Yes (must own) | Delete a menu item        |

**Search & uploads**

| Method | Route          | Auth | Description                                       |
|--------|-----------------|------|-----------------------------------------------------|
| GET    | /api/search?q=  | No   | Combined restaurant + menu item search (home page)  |
| POST   | /api/uploads    | Yes  | Multipart image upload - resized + recompressed to WebP server-side (`file` field, optional `category`: logo\|cover\|menu-item\|avatar) → returns public URL |

**Cart** (one active cart per user, single restaurant at a time)

| Method | Route                        | Auth | Description                                             |
|--------|-------------------------------|------|--------------------------------------------------------|
| GET    | /api/cart                     | Yes  | View current cart with items and subtotal               |
| POST   | /api/cart/items                | Yes  | Add item (`menu_item_id`, `quantity`, `special_instructions`, optional `replace: true`) |
| PUT    | /api/cart/items/:menuItemId    | Yes  | Update quantity / instructions for one item              |
| DELETE | /api/cart/items/:menuItemId    | Yes  | Remove one item                                           |
| DELETE | /api/cart                      | Yes  | Clear the whole cart                                       |

**Orders & checkout**

| Method | Route                        | Auth                         | Description                                     |
|--------|-------------------------------|-------------------------------|--------------------------------------------------|
| POST   | /api/orders/checkout           | Yes                           | Converts cart → order, initializes Paystack payment |
| GET    | /api/orders                    | Yes                           | Your order history (paginated)                   |
| GET    | /api/orders/:id                 | Yes (customer/owner/admin)   | Order detail                                      |
| PATCH  | /api/orders/:id/status          | Yes (restaurant owner/admin) | Advance order status                              |
| PATCH  | /api/orders/:id/cancel          | Yes (customer)                | Cancel while still pending/confirmed              |

**Payments**

| Method | Route                          | Auth | Description                                                      |
|--------|---------------------------------|------|------------------------------------------------------------------------|
| POST   | /api/payments/webhook            | No (Paystack signature-verified) | Receives `charge.success` events |
| GET    | /api/payments/verify/:reference  | Yes  | Manual fallback check right after the Paystack redirect              |

**Delivery tracking**

| Method | Route                                  | Auth                          | Description                                      |
|--------|------------------------------------------|---------------------------------|------------------------------------------------------|
| PATCH  | /api/delivery/:orderId/assign-agent       | Yes (restaurant owner/admin)   | Assign a `delivery_agent` profile to an order        |
| GET    | /api/delivery/agents/search?phone=         | Yes (restaurant owner/admin)   | Find a delivery agent by (partial) phone number |
| PATCH  | /api/delivery/:orderId/location            | Yes (assigned agent/admin)     | Push live lat/lng                                    |
| PATCH  | /api/delivery/:orderId/status              | Yes (assigned agent/admin)     | assigned → picked_up → en_route → delivered          |
| GET    | /api/delivery/:orderId                     | Yes (customer/owner/agent/admin) | Current tracking state + agent info                |
| GET    | /api/delivery/my-deliveries                | Yes (delivery_agent/admin)     | Agent's active delivery queue                        |

For a live-updating map, the frontend subscribes directly to `delivery_tracking`
via Supabase Realtime instead of polling.

**Reviews & notifications**

| Method | Route                          | Auth                | Description                                          |
|--------|----------------------------------|-----------------------|-----------------------------------------------------------|
| POST   | /api/reviews                      | Yes                  | Review a delivered order                                  |
| GET    | /api/restaurants/:id/reviews       | No                   | Public paginated reviews (listed above too)                |
| GET    | /api/reviews/mine                  | Yes                  | Your own review history (paginated)                        |
| PUT    | /api/reviews/:id                   | Yes (author/admin)   | Edit your review                                            |
| DELETE | /api/reviews/:id                   | Yes (author/admin)   | Delete your review                                          |
| GET    | /api/notifications                     | Yes  | List (`?unread_only=true&page=&limit=`)      |
| GET    | /api/notifications/unread-count         | Yes  | Badge count                                |
| PATCH  | /api/notifications/:id/read             | Yes  | Mark one as read                           |
| PATCH  | /api/notifications/read-all             | Yes  | Mark everything as read                    |
| DELETE | /api/notifications/:id                  | Yes  | Delete one                                  |

### Checkout flow, end to end
1. Frontend calls `POST /api/orders/checkout` with `delivery_address` (+ optional lat/lng).
2. Backend creates the order, snapshots cart items into `order_items`, clears the cart, and initializes a Paystack transaction.
3. Frontend redirects the browser to the returned `authorization_url`.
4. Paystack redirects back to `FRONTEND_URL/order-confirmation`. The frontend calls `GET /api/payments/verify/:reference` there as an immediate check.
5. In parallel, Paystack calls `POST /api/payments/webhook` - the actual source of truth (idempotent, so both paths converge safely).

## 7. Image optimization

`POST /api/uploads` runs every image through [sharp](https://sharp.pixelplumbing.com)
before storing it: resized to a sensible max width per category (512px for
logos/avatars, 1000px for menu photos, 1600px for covers) and re-encoded to
WebP at quality 82 - typically 25-35% smaller than an equivalent JPEG at the
same visual quality, with no size limit surprises for users uploading
straight-from-camera photos.

## 8. Logging & monitoring

`src/utils/logger.js` (winston) gives structured logs: readable/colorized in
development, JSON in production (ready to pipe into CloudWatch, Datadog, etc
without code changes). `src/middleware/requestContext.js` assigns every
request a UUID (returned as `X-Request-Id`), and logs method/path/status/
duration on completion - a lightweight, self-hosted alternative to a paid APM.
`src/server.js` also hooks `uncaughtException` (logs + exits, letting your
process manager restart cleanly) and `unhandledRejection` (logs, doesn't crash).

## 9. API documentation

Full OpenAPI 3.0 spec at `openapi.json`, served as interactive Swagger UI at
`/api/docs`. Covers every endpoint with auth requirements, request bodies, and
response shapes.

## Project structure

```
delixious-backend/
├── src/
│   ├── app.js                        # Express app (exported for tests - no listening)
│   ├── server.js                     # thin bootstrap: imports app, calls .listen()
│   ├── config/supabase.js            # admin + anon Supabase clients
│   ├── middleware/
│   │   ├── auth.js                   # reads access_token cookie, verifies, attaches req.user/profile
│   │   ├── csrf.js                   # double-submit cookie CSRF protection
│   │   ├── validate.js               # zod request validation middleware factory
│   │   ├── ownership.js              # restaurant/menu-item ownership checks
│   │   ├── requestContext.js         # request ID + timing/logging
│   │   └── errorHandler.js
│   ├── schemas/*.schema.js           # zod schemas, one file per resource
│   ├── utils/
│   │   ├── authCookies.js            # sets/clears the three auth cookies
│   │   ├── cart.js
│   │   ├── logger.js                 # winston structured logger
│   │   └── paystack.js
│   ├── controllers/                  # one per resource
│   └── routes/                       # one per resource, wires validation + auth + controller
├── tests/                            # vitest + supertest (28 tests)
├── supabase/schema.sql                # full DB schema + RLS policies + Realtime publication
├── openapi.json                      # served at /api/docs
├── vitest.config.js
├── .env.example
└── package.json
```

## Testing the Paystack webhook locally

Paystack can't reach `localhost`. Use a tunnel while developing:
```bash
npx ngrok http 5000
```
Then set that ngrok HTTPS URL + `/api/payments/webhook` as your webhook URL in
the Paystack dashboard temporarily, and switch it to your real Render URL
before going live.

## Deploying

- **Backend**: Render (free tier works; add every `.env` variable under
  Environment; free instances sleep after inactivity, so consider a
  cron-job.org ping to keep it warm). Set `NODE_ENV=production` there (only
  there - see the warning in `.env.example` about local dev).
- **Frontend**: Netlify or Vercel - point its `VITE_API_URL` at your deployed
  Render URL, and make sure this backend's `FRONTEND_URL` matches the deployed
  frontend's origin exactly (needed for CORS-with-credentials and the
  Paystack callback URL).

## Known trade-offs (documented, not hidden)

- **CSP disabled** in helmet: this is a JSON API, and Swagger UI needs inline
  scripts. Every other helmet protection stays on. If you later serve any
  HTML directly from this backend, revisit this.
- **Order queue polling, not Realtime**: the owner dashboard polls
  `/restaurants/:id/orders` every 20s rather than subscribing to Realtime
  (only `delivery_tracking` is in the Realtime publication right now). Fine
  for typical order volumes; upgradeable later the same way tracking does it.
- **uuid stayed at v10**: `npm audit` flags a moderate advisory, but it only
  affects passing a `buf` option to `uuid.v4()`, which this codebase never
  does. Bumping to v11+ is a bigger breaking change than the (non-exploitable,
  here) advisory warrants right now.
