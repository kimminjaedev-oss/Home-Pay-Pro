# Goval — Property Management Payment Platform

A web portal for apartment unit owners to view their maintenance fee balance and pay online. Admins can import households from Excel, monitor payment stats, and manage all units from a dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/property-mgmt run dev` — run the frontend (port 18558)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (via `@clerk/express` on server, `@clerk/react` on client)
- Payments: Stripe Checkout
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB tables: `users`, `households`, `payments`
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/property-mgmt/src/pages/` — React pages (landing, dashboard, admin, payment)

## Architecture decisions

- Contract-first: OpenAPI spec → Orval → Zod schemas + React Query hooks. Routes validate against generated schemas.
- JIT user provisioning: Clerk manages identity; after sign-in a `POST /api/auth/provision` call syncs the user into the local DB and matches them to a household by email or unit number.
- Balance matching: When a user provisions, the system tries to match their email to an existing household and copies the unpaid balance.
- Stripe Checkout: No credit card data touches the server. Stripe Checkout session created server-side; balance updated via webhook after `checkout.session.completed`.
- Admin role: Set `role = 'admin'` in the `users` table directly via DB for the first admin.

## Product

- **Residents:** Sign in with Clerk → see unit number, unpaid balance, monthly fee, total due → enter custom amount → pay via Stripe Checkout → view payment history
- **Admins:** See stats (total households, paid/unpaid counts, revenue collected) → search/filter households → upload Excel to import/update households → view all payments
- **Excel import:** Frontend parses `.xlsx` file using `xlsx` package → sends JSON rows to `POST /api/admin/import` → server upserts households and updates linked user balances

## User preferences

- Monthly maintenance fee is $36 (constant `MONTHLY_FEE` in `artifacts/api-server/src/routes/households.ts`)

## Gotchas

- Always run `pnpm run typecheck:libs` after changing DB schema or OpenAPI spec before typechecking leaf packages
- Raw body middleware for Stripe webhook must be mounted BEFORE `express.json()` in `app.ts` — already configured
- First admin user must be set manually: `UPDATE users SET role = 'admin' WHERE email = 'your@email.com';`
- Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`) must match what's configured in the Stripe dashboard for the webhook endpoint

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
