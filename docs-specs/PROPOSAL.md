# Srodae Zonal Council Database System for Temporal Structures

## PROPOSAL.md — Phase 1: The What and Why

---

## 1. Problem Statement

The Srodae Zonal Council (New Juaben South Municipal Assembly) currently
tracks fees for temporal/temporary structures (kiosks, containers, market
stalls, sheds) on paper or scattered spreadsheets. When the Electoral Area
is known, records are difficult to search, balances cannot be computed
reliably, and the council cannot produce an on-demand statement of who owes
what per electoral area.

## 2. Core Value Proposition

A single, secure web application where zonal council staff can:

- Register every temporal-structure fee payer once
- Have the system generate the record's serial number automatically
- Record fees (in GH₵), payments, and running balances
- Filter and report by Electoral Area in real time
- Print/export the register for council meetings and audits

## 3. High-Level Functional Modules

1. **Records Management** — create, edit, view, deactivate fee-payer records
   with fields (in form/display order): Name, Business Name, Telephone,
   **Electoral Area** (select, comes before Street Name — selecting it
   generates the serial number), Street Name, Fee (GH₵), Balance, Total
2. **Serial Number Generation** — automatic, per-Electoral-Area serial
   numbering (format defined in Blueprint)
3. **Payments & Balance Tracking** — record payments; Balance and Total
   recompute automatically and immutably
4. **Electoral Area Filter & Reporting** — filter views, area summaries
   (count, total billed, total collected, outstanding)
5. **Authentication** — staff login; admin role for user management
6. **Audit Trail** — every create/edit/payment leaves an immutable log entry

## 4. Success Metrics

- A record created in < 1 minute including serial number
- Balance = Total billed − Total paid, always, with no manual math
- Any electoral area's outstanding list produced in < 10 seconds
- Zero data loss; full audit trail queryable

## 5. Out of Scope (v1)

- Online payments (MoMo integration)
- SMS notifications
- Multiple assemblies / zones beyond Adweso
- Offline-first PWA (may be added later)

---

## Success Criteria for Approval

- [ ] Dickson confirms the 5 electoral areas are exactly:
      Adweso Estate, Adweso Town, Two Streams, Nyerede North, Nyerede South
- [ ] Dickson confirms serial number format expectation
      (see proposal question below)
- [ ] Dickson confirms who uses it (just him? zonal staff? how many users?)