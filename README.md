# ScrapScan

Barangay waste segregation and rewards platform (pilot: ~50 households).
Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 · PostgreSQL.

## Run it locally

```bash
cp .env.example .env                 # then set SESSION_SECRET:  openssl rand -base64 48
docker compose up -d                 # local Postgres 16
npm install                          # also runs `prisma generate`
npx prisma migrate dev --name init   # creates the tables
bash scripts/add-constraints-migration.sh   # turns prisma/db-constraints.sql into a migration
npx prisma migrate dev               # applies it (append-only ledger, CHECK constraints)
npm run db:seed                      # admin, collector, 1 resident, 50 households, 3 rewards
npm run dev                          # http://localhost:3000
```

Demo logins (password `Password123!`): `admin@scrapscan.test`, `collector@scrapscan.test`, `maria@scrapscan.test`.
The seed prints a claim code for an unclaimed household so you can try sign-up.

Use a phone on the same network or a Vercel preview URL to test camera scanning later (cameras need HTTPS).

## Checks

```bash
npm run typecheck && npm run lint
npm test        # unit tests always; the auth/RBAC integration tests run when DATABASE_URL is set
```

## How it fits together

- **Roles:** `CITIZEN`, `COLLECTOR`, `ADMIN` in `src/lib/rbac.ts` (the permission matrix lives there).
  `src/proxy.ts` is a coarse route gate only. Pages call `requireRole` / `requirePagePermission`;
  server actions and route handlers call `requirePermission`. Scope (household, collector) is always taken
  from the signed-in account, never from the URL or form.
- **Auth:** email or PH mobile + password, signed session cookie (`jose`), DB re-checked on every request so
  deactivated accounts lose access immediately. Collector sessions last 30 days so queued scans can sync.
- **Households:** admins create them (with a QR token and a one-time claim code). Residents sign up with that code.
- **Scoring:** `src/lib/scoring.ts`, server-side only. 0 contaminated bins = 10, 1 = 5, 2-3 = 0 (**proposed, confirm with the barangay**).
- **Ledger:** append-only (DB trigger). Corrections are `REVERSAL` rows with a reason.
- **Neon:** `DATABASE_URL` = pooled string, `DIRECT_URL` = direct string.

## Not built yet (shown as unavailable in the UI, never as dead buttons)

Collector scan + checklist + offline queue, collection endpoint, reward requests, collector management,
analytics charts, password reset by email, QR sticker print sheet, Filipino/English toggle.
