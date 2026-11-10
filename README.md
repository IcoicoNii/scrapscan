# ScrapScan

Barangay waste segregation and rewards platform (pilot: ~50 households).
Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 · PostgreSQL.
Node 22.12+ or 24 (Vitest 5 needs it).

## Run it locally

```bash
cp .env.example .env                 # then set SESSION_SECRET:  openssl rand -base64 48
docker compose up -d                 # local Postgres 16
npm install                          # also runs `prisma generate`
npx prisma migrate dev               # creates the tables + append-only ledger trigger and CHECK constraints
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
- **Ledger:** append-only (DB trigger, migration `*_db_constraints`). Corrections are `REVERSAL` rows with a reason.
- **Collections:** `POST /api/collections` (`src/lib/collections.ts`), collectors only. The device sends a UUID it
  generated, the household (`{ qrToken }` or `{ code }`), `collectedAt` and the three bin results; the server scores it
  and writes the collection + `AWARD` row in one transaction. Same id + same payload = stored result (200), never a
  second award; same id + different payload = the stored collection is `FLAGGED` for review and its points are held by a
  system `REVERSAL` row (409; an admin releases the hold by reversing that row). One collection per
  household per Manila day (409 `ALREADY_COLLECTED`). Client retry rule: 2xx done, 401 sign in and retry, other 4xx
  final, 5xx/network keep queued and retry with the same id.
- **Scan screen:** `/collector/scan`. Camera QR scanning uses the browser's `BarcodeDetector` where available and
  falls back to `jsqr` (iPhones). `POST /api/households/lookup` confirms the household (and whether it was already
  collected today) before the bin checklist.
- **Offline scanning** (it's a web app, so this is all browser tech: IndexedDB + a service worker, no app store):
  - Every save is written to the phone (IndexedDB, `src/lib/offline/queue.ts`) *before* it's sent; queued payloads are
    never changed, so retries are idempotent. Items belong to the collector who saved them and are only sent by that
    collector's session. Sending happens while the page is open: on load, when back online, when the app returns to the
    front, and on a backoff timer (30s → 10m). Refused items go to **Saved → Needs attention** with the server's reason.
  - `GET /api/collector/directory` gives the phone a minimal household list for offline lookups: number, name, purok,
    SHA-256 fingerprints of active QR tokens (never the tokens), last collection day. No addresses, claim codes or
    contacts. It's only used by the collector who downloaded it, deleted on logout, and expires after 7 days.
  - `public/sw.js` makes `/collector`, `/collector/scan` and `/collector/queue` open with no signal (network first, saved
    copy as fallback) and caches `/_next/static` build files. It's registered in production builds only. Saved pages are
    deleted on logout. Bump `VERSION` in `sw.js` to drop old caches.
  - Limits of a web app: nothing sends while the browser is closed (open ScrapScan when back in signal); iPhone Safari may
    clear site data after ~7 days unused unless it's added to the Home Screen; camera and offline loading need HTTPS.
- **Neon:** `DATABASE_URL` = pooled string, `DIRECT_URL` = direct string.

## Not built yet (shown as unavailable in the UI, never as dead buttons)

Admin review of flagged collections, reward requests, collector management,
analytics charts, password reset by email, QR sticker print sheet, Filipino/English toggle.
