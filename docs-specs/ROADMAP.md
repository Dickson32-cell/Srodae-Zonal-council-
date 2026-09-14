# Srodae Zonal Council Database System — ROADMAP.md
Phase 3: The Build of the Work

All serial codes CONFIRMED by Dickson 12 Sep:
ADW. E (Adweso Estate) | ADW. T (Adweso Town) | T. S (Two Streams) |
NYE. N (Nyerede North) | NYE. S (Nyerede South) | OSA. M (Osabene Mile 50)

---

## Stack

- Next.js 15 (App Router, TypeScript) + Prisma ORM
- PostgreSQL (Neon serverless — proven infra)
- Auth: username + bcrypt, httpOnly session cookie
- Deployment: Vercel private project (HTTPS)
- Design: municipal-professional CSS system (no AI-look, no emoji),
  print-friendly reports

## Phase 0 — Project scaffold (30 min)

- [ ] 0.1 Create Next.js app in this folder (adweso-register)
- [ ] 0.2 Prisma schema (6 tables: fee_payer, fee, payment, serial_counter,
      app_user, audit_log) + `npx prisma db push` to a NEW Neon project
      `adweso-register` (separate from FarmLink)
- [ ] 0.3 Seed: serial_counter (6 rows, one per area, last_number=0) +
      first admin user (Dickson) with bcrypt password
- [ ] 0.4 Verify: `SELECT * FROM serial_counter` returns 6 rows

## Phase 1 — Engine: serial generator + records API (core, no UI)

- [ ] 1.1 Serial generation transaction (SELECT ... FOR UPDATE on
      serial_counter → increment → format "CODE/ NN") as a Prisma
      $transaction; retry on P1001
- [ ] 1.2 POST /api/records — create fee payer (validates all fields;
      telephone 0XXXXXXXXX; fee DECIMAL(12,2) > 0) → returns serial
- [ ] 1.3 GET /api/records — list w/ filters: electoral_area, q (name/
      business/serial), status; each row carries computed Fee, Balance,
      Total; response includes per-area summary + GRAND TOTAL block
- [ ] 1.4 PATCH /api/records/:id — edit identity fields; select status
      PAID → auto-write settlement payment row (ledger truth)
- [ ] 1.5 POST /api/records/:id/payments — record cash payment manually
      (partial payments possible; Balance recomputes)
- [ ] 1.6 Audit-log writer wired into every mutation
- [ ] 1.7 STEEL THREAD TEST (scripted, no UI): create record in Adweso
      Town → serial "ADW. T/ 01"; second record "ADW. T/ 02"; one in
      Adweso Estate → "ADW. E/ 01" (independent counters!); fee 50.00 →
      Total 50.00 Balance 50.00; pay 20.00 → Balance 30.00; mark PAID →
      Balance 0.00 AND Total 0.00; list w/ grand totals sums correct.
      Loop: fix → re-run until 100% green.

## Phase 2 — Auth (login only, no public access)

- [ ] 2.1 Login page + /api/auth/login (bcrypt compare, httpOnly cookie)
- [ ] 2.2 Session middleware: every page + API route requires session
- [ ] 2.3 Logout; 8h session expiry
- [ ] 2.4 Admin (Dickson) can create/deactivate staff accounts
- [ ] 2.5 Verify: no route reachable without login (curl 401 sweep)

## Phase 3 — Surface (UI)

- [ ] 3.1 Register table page — columns in Dickson's exact order:
      Serial No | Name | Business Name | Telephone | Electoral Area |
      Street Name | Fee (GH₵) | Balance | Total
- [ ] 3.2 Area filter dropdown (All + 6 areas) + search box + UNPAID/PAID
      status filter
- [ ] 3.3 New Record form — field order: Serial (auto, appears on area
      select) | Name | Business | Telephone | Electoral Area (BEFORE
      Street) | Street | Fee; live serial preview on area select
- [ ] 3.4 Record detail/edit page + "Mark Paid" action + payment entry
- [ ] 3.5 Reports page: per-area summary table + GRAND TOTAL row;
      CSV export; print-friendly stylesheet (A4)
- [ ] 3.6 Full CSS design system: variables, card hierarchy, badges
      (UNPAID amber / PAID green), Ghana municipal styling, zero emoji
- [ ] 3.7 Overseer critique + polish pass

## Phase 4 — Verification loop (build → test → fix → rebuild)

- [ ] 4.1 `npm run build` clean, zero TS errors
- [ ] 4.2 Full steel thread THROUGH THE UI (browser): login → create →
      serial preview correct → pay → mark paid → 0.00/0.00 → filter →
      grand totals correct
- [ ] 4.3 Concurrent-create test: two rapid creates same area → distinct
      serials, no duplicates
- [ ] 4.4 Negative tests: unauthenticated access blocked; payment >
      balance rejected; bad telephone rejected
- [ ] 4.5 README.md: setup, credentials table (admin/staff), full
      walkthrough, architecture diagram, troubleshooting
- [ ] 4.6 Deploy (Vercel private) + live steel-thread verification
- [ ] 4.7 Handover to Dickson: credentials + walkthrough in chat

## Out of scope (v1)

MoMo, SMS, PWA offline, photos, map/GPS, multi-zonal.