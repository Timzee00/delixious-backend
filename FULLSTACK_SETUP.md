# Delixious — Combined frontend and backend

This one repository contains the Delixious food-delivery platform, including **all 80 frontend files** from `Timzee00/delixious-frontend` and the existing Express backend, database migrations, tests, and OpenAPI spec.

## Project structure

- `frontend/`: React + Vite interface, pages, components, CSS, frontend tests, Netlify backup configuration.
- `src/`: Express backend API, authentication, payments, restaurant/order/rider/admin routes, validation, middleware.
- `supabase/`: database schema and migrations.
- `tests/`: backend tests. `frontend/tests/`: frontend tests.
- `scripts/prepare-frontend.mjs`: builds the bundled frontend in production, without cloning another repo.
- `render.yaml`: deployment as one Render service. The backend serves `frontend/dist`.

## Local development (Node.js 20+)

1. `npm ci` (backend dependencies)
2. `npm ci --prefix frontend` (frontend dependencies)
3. Copy `.env.example` to `.env` and `frontend/.env.example` to `frontend/.env`. Supply your own environment variable values; NEVER commit live keys.
4. In terminal A: `npm run dev` (Express API).
5. In terminal B: `npm run dev:frontend` (Vite frontend, port 5173). Local API base defaults to `/api`; configure Vite proxy or `VITE_API_URL=http://localhost:<backend-port>/api` if needed. Note that separate origins may need cookie/CORS setup; single-origin production avoids this.
6. Test: `npm test`, `npm run test:frontend`.
7. Build frontend: `npm run build` and then `npm start`.

## Render (one service)

The `render.yaml` build command is `npm ci`. In production, the backend's postinstall installs frontend dependencies and builds `frontend/dist` from this repository. The existing Express code serves the built SPA and `/api/*` on the same origin.

Do **not** set the Render root directory to `frontend`. Set backend/Paystack/Supabase credentials in the Render environment, and frontend `VITE_*` variables at **build time**. Keep secrets server-side (never expose a service-role key or Paystack secret via `VITE_*`).

The original independent Netlify frontend can remain untouched during the transition. To deploy the frontend folder from this monorepo to Netlify, configure base directory `frontend` and publish `dist` (relative to base).

## Source provenance

- Frontend source: https://github.com/Timzee00/delixious-frontend at commit `86e037e8fb3478ebef7b383082fec0b21cb80254`.
- Backend source: https://github.com/Timzee00/delixious-backend at commit `a99e769848e9bc7c0d22899cd410567fede4a33c`.
- Both original repositories remain available; no deployments or databases were changed as part of the consolidation.

For backend API details, see the rest of the root README. Frontend documentation is in `frontend/README.md`.
