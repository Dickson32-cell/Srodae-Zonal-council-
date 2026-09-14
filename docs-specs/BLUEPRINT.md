# Srodae Zonal Council Database System — BLUEPRINT.md
Phase 2: The How (Technical Architecture)

---

## 1. System Architecture

Three-tier web application (proven FarmLink GH stack):

```
┌─────────────────────────────────────────────┐
│  SURFACE (Browser)                          │
│  Next.js 15 App Router + React              │
│  - Login page                               │
│  - Records table (filterable by Area)        │
│  - New/Edit Record form                     │
│  - Payment entry                            │
│  - Area summary dashboard                   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (server actions / API routes)
┌──────────────────▼──────────────────────────┐
│  ENGINE (Server)                            │
│  Next.js API routes + business logic        │
│  - Serial number generator (transactional)   │
│  - Balance/Total computation                 │
│  - Payment ledger                            │
│  - Audit trail writer                        │
│  - Session auth (bcrypt + httpOnly cookie)  │
└──────────────────┬──────────────────────────┘
                   │ Prisma ORM
┌──────────────────▼──────────────────────────┐
│  DATA (PostgreSQL)                           │
│  Neon serverless Postgres                    │
└─────────────────────────────────────────────┘
```

## 2. Data Model

### Table: `fee_payer` (the register — one row per structure/fee payer)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, default gen_random_uuid() |
| serial_number | VARCHAR(20) | UNIQUE, NOT NULL — e.g. "ADW. T/ 01" |
| electoral_area | ENUM | NOT NULL — one of 6 areas (incl. OSA. M for Osabene Mile 50) |
| name | VARCHAR(120) | NOT NULL |
| business_name | VARCHAR(150) | NOT NULL |
| telephone | VARCHAR(10) | NOT NULL, format 0XXXXXXXXX |
| street_name | VARCHAR(150) | NOT NULL |
| fee | DECIMAL(12,2) | NOT NULL — typed by staff (cash council charge) |
| status | ENUM | UNPAID / PAID, default UNPAID — staff selects Paid |
| record_status | ENUM | ACTIVE / INACTIVE, default ACTIVE (soft delete) |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |
| updated_at | TIMESTAMPTZ | auto-update |

### Computed columns (calculated by the system, never typed)

- **Balance** = fee − cash_received. When status = PAID → system records
  full settlement → Balance displays **GH₵ 0.00**
- **Total** = the payer's total (sum of fee rows). When PAID → displays
  **GH₵ 0.00** (Dickson confirmed both zeros: "the balance ... and the
  total would be GHc 0.00 — meaning the person has paid")

### Table: `fee` (billing events — supports cumulative "Total")

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| fee_payer_id | UUID | FK → fee_payer, NOT NULL |
| amount | DECIMAL(12,2) | NOT NULL, CHECK (amount > 0) |
| description | VARCHAR(200) | e.g. "Annual temporal structure fee 2026" |
| billed_at | DATE | NOT NULL, default today |
| created_by | UUID | FK → app_user |
| created_at | TIMESTAMPTZ | NOT NULL |

**Total (per fee payer) = SUM(fee.amount)** — computed, never stored.

### Table: `payment` (cash actually received — the ledger)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| fee_payer_id | UUID | FK → fee_payer, NOT NULL |
| amount | DECIMAL(12,2) | NOT NULL, CHECK (amount > 0) |
| received_at | DATE | NOT NULL, default today |
| method | ENUM | CASH (council takes cash — default) |
| receipt_no | VARCHAR(30) | optional, unique if given |
| received_by | UUID | FK → app_user |
| created_at | TIMESTAMPTZ | NOT NULL |

**Balance (per fee payer) = SUM(fee.amount) − SUM(payment.amount)** —
computed live. Marking status = PAID auto-records a settlement payment
for the outstanding remainder, so Balance and Total both read GH₵ 0.00
and the ledger stays truthful.

### Table: `serial_counter` (the per-area sequence — transactional safety)

| Column | Type | Constraints |
|---|---|---|
| electoral_area | ENUM | PK (one row per area — SIX rows, pre-seeded) |
| last_number | INT | NOT NULL, default 0 |

### Table: `app_user` (staff logins)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| username | VARCHAR(50) | UNIQUE, NOT NULL |
| password_hash | TEXT | bcrypt, NOT NULL |
| full_name | VARCHAR(120) | NOT NULL |
| role | ENUM | ADMIN / STAFF, default STAFF |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | NOT NULL |

### Table: `audit_log` (immutable trail — every change)

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | UUID | FK → app_user |
| action | ENUM | CREATE_RECORD / UPDATE_RECORD / RECORD_PAYMENT / ADD_FEE / DEACTIVATE / LOGIN |
| entity_type | VARCHAR | 'fee_payer' / 'payment' / 'fee' |
| entity_id | UUID | affected row |
| details | JSONB | before/after snapshot |
| created_at | TIMESTAMPTZ | NOT NULL |

## 3. Serial Number Engine (the critical mechanism)

**Trigger:** user selects Electoral Area in the New Record form.

**Flow (transactional — inside one DB transaction):**

```
1. BEGIN TRANSACTION
2. SELECT last_number FROM serial_counter
     WHERE electoral_area = <selected>
     FOR UPDATE              ← locks the row; no two users can grab
                              the same next number
3. next = last_number + 1
4. UPDATE serial_counter SET last_number = next
     WHERE electoral_area = <selected>
5. serial_string = area_code(selected) + "/ " + zero-pad(next, 2)
     e.g. Adweso Town #1 → "ADW. T/ 01"
6. INSERT fee_payer with serial_number = serial_string
7. COMMIT
```

**Rules:**
- One counter per area (5 rows in serial_counter, pre-seeded)
- Numbers never reused — deletion of a fee_payer does NOT decrement
- Zero-padding: 2 digits up to 99, then natural width (100, 101 …)
- The generated serial appears on-screen immediately after area selection
  (preview) and is committed with the record (final)
- Race-proof: FOR UPDATE lock means concurrent staff can never duplicate
  a serial, even on flaky connections (transaction retries on P1001)

**Area codes (Adweso Town CONFIRMED, rest proposed — awaiting Dickson):**

| Area | Code | Example |
|---|---|---|
| Adweso Town | ADW. T | ADW. T/ 01 |
| Adweso Estate | ADW. E | ADW. E/ 01 |
| Two Streams | T. S | T. S/ 01 |
| Nyerede North | NYE. N | NYE. N/ 01 |
| Nyerede South | NYE. S | NYE. S/ 01 |

## 4. Steel Thread (the one critical path that must work end-to-end)

**Staff logs in → creates record (pick Electoral Area → serial appears:
"ADW. T/ 07") → saves with fee GH₵ 50 → Total shows 50.00, Balance 50.00
→ records payment GH₵ 20 → Balance shows 30.00 → filters list by
"Adweso Town" → sees the record with correct serial, totals.**

Validation of this thread = the engine works. Everything else is surface.

## 5. Security

- **Auth:** username + bcrypt password, httpOnly secure session cookie;
  no anonymous access to any page or API route
- **Sessions expire** after 8h inactivity; re-login required
- **RBAC:** ADMIN manages users + can deactivate records; STAFF can
  create records, add fees, record payments (default role)
- **All money as DECIMAL(12,2)** — never float (the ALY6420 lesson,
  applied)
- **Audit log is append-only** — no API route can update or delete it
- **Municipal data:** deployed privately; no public registration;
  database on Neon (same proven infra as FarmLink GH); daily automated
  backups via Neon PITR
- HTTPS everywhere; production deployment on Vercel (private project)

## 6. Reports (v1)

- **Register table** with columns in Dickson's exact order:
  Serial No | Name | Business Name | Telephone | Electoral Area |
  Street Name | Fee (GH₵) | Balance | Total
- Filter: by Electoral Area (default: All); search by name/business/serial
- **Area summary row:** per area — count of records, total billed,
  total collected, total outstanding
- **GRAND TOTALS (confirmed 12 Sep):** every report ends with a grand
  total row — total records, grand total Fee billed, grand total
  Balance outstanding, grand total collected. System computes all
  sums; staff never add anything by hand.
- Export: CSV (opens in Excel for council meetings); print-friendly view
- Receipt view per payment (printable)

## 7. Out of Scope (v1 — revisit later)

MoMo payments, SMS reminders, PWA offline, photos of structures,
map/GPS, multi-zonal support, public-facing search.