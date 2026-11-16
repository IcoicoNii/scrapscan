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
- **Households and sign-up:** residents register their own household at `/register` ("Register my household": name,
  address, purok). It gets its HH number and QR code at once but is `PENDING`: every collector path requires `ACTIVE`, so
  it can't be recorded until an admin approves it (`/admin/households?status=PENDING`, with possible duplicates shown;
  declining turns it off with a note the resident sees). Admins can also create households directly (active at once).
  Each household's sign-up code (`claimCode`) lets family members join ("I have a sign-up code"), up to 5 accounts;
  residents and admins can replace a leaked code, and admins can move a resident to another household. Logic in
  `src/lib/households.ts`.
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
- **Flagged-collection review:** `/admin/reviews` (`src/lib/reviews.ts`, permission `collection:review`). Each card
  compares the saved collection with what the conflicting resend said (recorded in the flag's audit row by household
  code, never the raw QR token). The admin gives a reason and either **releases** it (back to `VERIFIED`; a `REVERSAL`
  of the hold returns the points) or **doesn't count** it (`REJECTED`; the hold stays). Stored bins never change, a
  collection can only be decided once (two admins at once: one wins), and the decision + reason go in the audit log.
  Residents see "on hold" while it's flagged and "not counted" if rejected, never the admin's reason.
- **Household admin:** `/admin/households/[code]` edits details, turns a household off/on, replaces its QR code (old
  sticker refused at once), and stops counting a wrongly recorded collection (`REJECTED` + reversal of its award; bins
  never change). `/admin/households/print` prints QR stickers 3 across, optionally with names and cut-off sign-up slips.
- **Accounts:** `/admin/accounts` adds collectors/admins with a one-time temporary password (they must choose their own
  at `/change-password`), resets passwords and turns accounts off/on. Every session carries the account's
  `sessionVersion`; a reset, password change or deactivation bumps it, which signs out all older sessions at once.
  Residents still sign up themselves with a household code.
- **Rewards:** residents request rewards on `/citizen/rewards`; points are held at once (`REDEMPTION_HOLD`, household row
  locked so two taps can't overspend) and a stock unit is reserved. Admin (`/admin/rewards`) approves → marks picked up
  (points stay spent), or rejects with a note (hold reversed, stock returned). Residents can cancel before approval. Max 3
  open requests per household. The catalogue is managed on the same page.
- **Collections and audit:** `/admin/collections` shows one Manila day (filter by collector/status); `/admin/audit` lists
  every audited change with who, when and why.
- **Analytics:** `/admin/analytics` (7 / 30 / 90 days): households reached, sorting quality (share of 10/5/0-point
  collections), points earned vs spent, purok comparison and collector activity; the overview has a 14-day chart.
  Numbers are computed in `src/lib/analytics.ts` (pure, unit-tested) from rows loaded by `analytics-data.ts`. Charts are
  plain SVG (`src/components/charts.tsx`), with a hover/arrow-key readout and a "Show data" table; colors in
  `src/lib/chart-colors.ts` were checked for color-blind separation.
- **Password reset by email:** `/forgot-password` → emailed link → `/reset-password`. Only a SHA-256 of the token is
  stored; it works once, for 30 minutes; a newer link cancels older ones; max 3 per account per hour; the page answers
  the same whether or not the email has an account, and the email is sent after the response. A reset signs the
  account out everywhere. Links use `APP_URL` (never the request's Host header). Set `SMTP_*`, `MAIL_FROM` and `APP_URL`
  (see `.env.example`); without them, development prints the email to the console and production falls back to
  "ask your barangay admin". Accounts with only a mobile number still get admin resets.
- **Languages (English / Filipino):** resident, collector, sign-in and public pages; admin pages stay English. The
  choice is a cookie (`ss_lang`, EN | FIL switch in the menus and sign-in pages), defaulting to the browser's language.
  Dictionaries are `src/lib/i18n/en.ts` and `fil.ts` (the compiler and a test check they match); privacy and terms keep
  a full text per language. Server messages shown to residents and collectors (scan errors, sign-up, rewards) are
  translated too. **Have a native speaker review `fil.ts` before the pilot.**
- **Neon:** `DATABASE_URL` = pooled string, `DIRECT_URL` = direct string.

## Not built yet (shown as unavailable in the UI, never as dead buttons)

Password reset by text message (mobile-only accounts use admin resets), translated browser-tab titles.
