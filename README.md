# Srodae Zonal Council — Temporal Structures Register

Cloned from the Adweso system. Same design, same integrity model
(transaction-locked per-area serials, settlement ledger, audit log,
role tiers, GPS, Excel export, 30s auto-refresh).

## Licensing
Free for the first 100 registrations. At 100 the register locks
(no new entries, no Excel export) until the US$5 licence fee is paid
to RAMEDIC Consultancy & Creative Ltd (MTN MoMo 0595 726 252).
An unlock key is then issued; locks again at each further 100.

COUNCIL_ID: srodae
Electoral areas: Srodae, Srodae Adweso, Oyirim

## Setup
1. Create a Neon database -> put DATABASE_URL in .env
2. .env also needs SESSION_SECRET, COUNCIL_ID=srodae, LICENSE_SECRET, ADMIN_PASSWORD
3. npm install && npx prisma db push && node prisma/seed.js
4. npm run build && deploy (Vercel) -> set the same env vars on Vercel

Electoral areas and codes are defined in src/lib/db.ts — editable anytime.
