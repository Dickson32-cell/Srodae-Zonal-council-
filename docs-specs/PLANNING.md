# Srodae Zonal Council Database System — Planning

## Project Rationale

The Srodae Zonal Council (under New Juaben South Municipal Assembly, where
Dickson serves as Assistant Director) needs to computerize the register of
temporal structures (kiosks, containers, stalls) and their fee payments.
This is an official municipal record system — accuracy and auditability are
non-negotiable.

## Fields (per Dickson's specification)

| Field | Type | Notes |
|---|---|---|
| Serial Number | AUTO | FIRST item on the list. Generated when Electoral Area is selected. Format: ADW. T/ 01 (area code + "/ " + 2-digit sequence) |
| Name | text | required |
| Business Name | text | required |
| Telephone | text | Ghana format 0XXXXXXXXX |
| Electoral Area | select | Adweso Estate / Adweso Town / Two Streams / Nyerede North / Nyerede South / **Osabene Mile 50** — comes BEFORE Street Name (Dickson's order); serial number generates on selection |
| Street Name | text | required |
| Fee (GH₵) | money | TYPED IN by staff (cash council charge) |
| Balance | COMPUTED | Fee − cash received. When PAID selected: shows GH₵ 0.00 |
| Total | COMPUTED | Person's total outstanding. When PAID: shows GH₵ 0.00 (Dickson confirmed: "the total would be GHc 0.00") |
| Status | AUTO + selector | UNPAID / PAID. Staff can select Paid → system records full cash settlement → Balance and Total read GH₵ 0.00 |

## Serial Number Logic (CONFIRMED by Dickson, 12 Sep)

- Serial Number is the FIRST item on the list (top of form; first column of table)
- Generated automatically when the Electoral Area is selected
- **Every electoral area has its own independent serial sequence** — five
  areas, five counters, starting at 01 each. Confirmed: "so every electoral
  area will have its serial number"
- Format: [Area code]/ [zero-padded sequence, starts at 01]

| Electoral Area | Serial format | Status |
|---|---|---|
| Adweso Town | ADW. T/ 01 | ✅ CONFIRMED by Dickson (his example) |
| Adweso Estate | ADW. E/ 01 | proposed — confirm |
| Two Streams | T. S/ 01 | proposed — confirm |
| Nyerede North | NYE. N/ 01 | proposed — confirm |
| Nyerede South | NYE. S/ 01 | proposed — confirm |
| Osabene Mile 50 | OSA. M/ 01 | proposed — confirm (ADDED 12 Sep — Dickson: "I left out Osabene Mile 50") |

Sequence: per Electoral Area, starting 01, incrementing per new record
(01, 02, 03 …). Numbers are never reused, even if a record is deleted —
the sequence only moves forward (auditability).

## Planning Status

- Phase 1 PROPOSAL.md drafted and awaiting Dickson's review/confirmation
- Blueprints (data model, serial logic, security) come next
- Stack proposal at Blueprint stage: PostgreSQL + Next.js web app
  (same proven stack as FarmLink GH), deployed privately

## Files

- PROPOSAL.md — vision + modules + success metrics
- (next) BLUEPRINT.md — architecture + data model
- (next) ROADMAP.md — build plan