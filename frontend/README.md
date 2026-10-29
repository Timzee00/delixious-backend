# Delixious Frontend

React (Vite) + Tailwind frontend for the Delixious food ordering platform,
consuming the delixious-backend API. Every screen from the original spec is
built, and the app has been through a production-readiness pass: cookie-based
auth (no tokens in JS at all), code splitting, lazy-loaded images,
pagination/virtualization, error boundaries, and automated tests.

## Setup

```bash
cp .env.example .env
# point VITE_API_URL at your running backend
npm install
npm run dev
```

Runs at http://localhost:5173. The backend's FRONTEND_URL env var must match
this origin exactly (cookies + CORS depend on it).

```bash
npm test    # vitest + testing-library (22 tests)
npm run build
```

## Authentication architecture

This app no longer stores any auth token in JavaScript-reachable storage.
The backend sets httpOnly cookies on login/signup; this frontend never reads
or holds access_token/refresh_token at all - AuthContext just tracks
user/profile state and calls GET /auth/me to check who's logged in.

- lib/api.js: axios instance with withCredentials: true (send/receive
  cookies), a request interceptor that echoes the readable csrf_token
  cookie back as an X-CSRF-Token header on every mutating request, and a
  response interceptor that catches 401 TOKEN_EXPIRED, calls
  POST /auth/refresh exactly once (concurrent 401s share a single in-flight
  refresh call, so a page firing several requests at once doesn't race to
  rotate the refresh token), and retries the original request. If refresh
  fails, it clears local auth state so the UI reflects "logged out" immediately.
- lib/csrf.js: reads the csrf_token cookie value from document.cookie.
- context/AuthContext.jsx: user ({id, email}), profile, login, signup,
  logout, updateProfile. No session object is exposed to the rest of the
  app - there's nothing sensitive left to expose.

## Performance

- Code splitting: every page is React.lazy()-loaded (see App.jsx), wrapped
  in a single Suspense with a lightweight fallback. The initial JS bundle
  dropped from ~500KB to ~60KB; each page fetches its own chunk on first visit.
- Vendor chunking (vite.config.js): React/Router and @supabase/supabase-js
  are split into their own cacheable chunks. Before this, Supabase's SDK
  (only used by the order-tracking page's Realtime subscription) was getting
  bundled entirely into that one page's chunk - 220KB for one page. After
  splitting, that page's own code is 6.6KB, and the shared 214KB Supabase
  chunk is cached independently.
- Image loading: every image in the app renders through the shared Img
  component, which adds loading="lazy" decoding="async" uniformly and falls
  back to a letter-avatar when there's no image yet (server-side, the
  backend also resizes/recompresses every upload - see its README).
- Pagination: "Load more" pagination on the restaurant grid, order history,
  notifications, and the owner dashboard's order queue - all backed by real
  page/limit/total params on the API, not just a client-side slice.
- Virtualization: the notifications list and the dashboard's menu list
  switch to react-window once the loaded set passes ~30-50 items, so a busy
  restaurant's full menu or a heavy notification history doesn't mean
  hundreds of live DOM nodes.

## Reliability & accessibility

- ErrorBoundary: wraps the router output in App.jsx. A render error anywhere
  shows a "this page hit a snag" card with Try again / Back to Home, instead
  of a blank white screen.
- Modal: shared overlay used by every modal in the app (confirmations, the
  menu-item form, agent assignment) - Escape closes it, focus moves into the
  dialog on open and back to the trigger on close, role="dialog" +
  aria-modal + aria-labelledby throughout.
- Skip-to-content link at the top of the page (visible on keyboard focus)
  for keyboard/screen-reader users to bypass the navbar.
- aria-live regions on error/success banners across every form, so screen
  readers announce validation errors and confirmations.
- Tests (vitest + testing-library/react): formatNaira, ConfirmModal
  (render/confirm/cancel/Escape/dialog semantics), FormField, ErrorBoundary
  (catches a thrown error, shows fallback, Try again doesn't itself crash),
  RestaurantCard (open/closed badge, rating display, image fallback).

## Code de-duplication

A few patterns were copy-pasted across 4-6 files before this pass; each now
has exactly one implementation:

| Shared component | Replaced local copies in |
|---|---|
| components/FormField.jsx | Login, Signup, Profile, RestaurantProfileSection, MenuManagementSection |
| components/ImagePicker.jsx | Profile (avatar), RestaurantProfileSection (logo/cover), MenuManagementSection (photo) |
| components/Img.jsx (lazy + letter-fallback) | RestaurantCard, MenuItemRow, Cart, Home (dish results), dashboard menu rows |
| components/Modal.jsx (overlay + Escape + focus) | ConfirmModal, the dashboard's menu-item form, agent-assignment modal |

## Project structure

```
delixious-frontend/
src/
  lib/
    api.js                axios instance: cookies, CSRF header, refresh-and-retry
    csrf.js                reads the csrf_token cookie
    supabase.js            optional client for Realtime delivery tracking
    format.js              Naira currency formatting
  context/
    AuthContext.jsx        user/profile state, login/signup/logout/updateProfile
    CartContext.jsx        shared cart state (badge + add-to-cart feedback)
    NotificationsContext.jsx
  components/
    Navbar.jsx
    ProtectedRoute.jsx
    ErrorBoundary.jsx
    PageLoader.jsx          Suspense fallback
    Modal.jsx               shared overlay (Escape, focus management)
    FormField.jsx           shared label+input/textarea
    ImagePicker.jsx         shared upload-with-preview
    Img.jsx                 shared lazy image + letter-fallback
    RestaurantCard.jsx
    MenuItemRow.jsx
    ConfirmModal.jsx
    StateViews.jsx          skeleton / empty / error states
    dashboard/
      RestaurantProfileSection.jsx
      MenuManagementSection.jsx   plus react-window virtualization
      OrdersQueueSection.jsx     plus pagination
  pages/                    one per route, all lazy-loaded from App.jsx
  App.jsx                   route table, lazy() + Suspense + ErrorBoundary
  main.jsx                  entry point (providers)
  index.css                 Tailwind + design system (.ticket, focus rings)
tests/                      vitest + testing-library (22 tests)
vite.config.js              manualChunks for vendor splitting
vitest.config.js
tailwind.config.js
.env.example
```

## Design system (unchanged from earlier phases)

Nigerian-food-inspired palette (pepper red, sand, ink) instead of the generic
cream/serif/terracotta AI look; Space Grotesk + Inter + IBM Plex Mono; the
"ticket stub" perforated-card signature used throughout.

## The checkout to payment to confirmation flow

1. Checkout.jsx posts to /api/orders/checkout, gets back payment.authorization_url.
2. Full browser redirect to Paystack (window.location.href - required, Paystack's checkout can't be iframed).
3. Paystack redirects back to FRONTEND_URL/order-confirmation, appending its own reference/trxref params.
4. OrderConfirmation.jsx calls GET /api/payments/verify/:reference as an immediate check and fetches the order for a summary.
5. The Paystack webhook (server-to-server) is the actual source of truth and converges safely with the above (idempotent both ways).

## Known trade-offs

- No offline/PWA support - out of scope for this pass.
- Dashboard order queue polls every 20s rather than using Realtime (matches
  the backend's current scope - only delivery_tracking is in the Realtime
  publication). Fine for typical order volumes.
- Virtualization thresholds are static (30 items for the menu list, 50 for
  notifications) rather than dynamically measured - reasonable defaults, easy
  to tune later if a specific restaurant's usage pattern calls for it.
