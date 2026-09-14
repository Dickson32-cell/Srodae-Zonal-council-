// LICENSE — per-council licensing: free for the first 100 registrations,
// then the register LOCKS (no new records, no Excel export) until the
// owner (RAMEDIC / Dickson) is paid US$5 and issues an unlock key.
// Locks again at 200, 300, ... — every 100 registrations.
//
// Unlock keys are derived from a per-council secret + the paid-until
// count, so one council's key cannot unlock another council's register.

import crypto from "crypto";
import { prisma, councilId } from "./db";

export const FREE_LIMIT = 100;      // registrations allowed before lock
export const LICENSE_FEE_USD = 5;   // price per 100 registrations

// ---------------------------------------------------------------------------
// License state table (already in schema: LicenseState). Single row (id=1)
// holds: registeredCount (copied from fee_payer count at check time — no,
// we COUNT live instead), paidThrough (number of registrations paid for),
// lastPaymentAt, licenseKey (the currently active unlock key).
// ---------------------------------------------------------------------------

export async function getLicenseState() {
  return prisma.licenseState.upsert({
    where: { id: councilId() },
    update: {},
    create: { id: councilId(), paidThrough: 0 },
  });
}

export async function countActiveRegistrations() {
  // Soft-deleted records do NOT count toward the license (fair to councils);
  // serial gaps from tests remain but ACTIVE rows are what matters.
  return prisma.feePayer.count({ where: { councilId: councilId(), recordStatus: "ACTIVE" } });
}

export type LicenseStatus = {
  registered: number;
  paidThrough: number;
  remainingFree: number;
  locked: boolean;
  nextUnlockAt: number; // registrations count at which it locks again
  feeUSD: number;
  payee: string;        // who to pay
  momoNumber: string;   // how to pay (mobile money)
};

export async function licenseStatus(): Promise<LicenseStatus> {
  const [state, registered] = await Promise.all([getLicenseState(), countActiveRegistrations()]);
  const locked = registered >= state.paidThrough + FREE_LIMIT;
  return {
    registered,
    paidThrough: state.paidThrough,
    remainingFree: Math.max(0, state.paidThrough + FREE_LIMIT - registered),
    locked,
    nextUnlockAt: state.paidThrough + FREE_LIMIT,
    feeUSD: LICENSE_FEE_USD,
    payee: "",
    momoNumber: "",
  };
}

// ---------------------------------------------------------------------------
// Key derivation: HMAC(councilSecret, `${councilId}:${paidThrough}`).
// The secret lives ONLY in the server env — councils cannot forge keys.
// ---------------------------------------------------------------------------

function councilSecret(): string {
  const s = process.env.LICENSE_SECRET;
  if (!s) throw new Error("LICENSE_SECRET not configured on server");
  return s;
}

export function deriveKey(councilId: string, paidThrough: number): string {
  const mac = crypto
    .createHmac("sha256", councilSecret())
    .update(`${councilId}:${paidThrough}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  // Group as XXXX-XXXX-XXXX-XXXX for readability over the phone
  return mac.replace(/(.{4})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4");
}

export function verifyKey(councilId: string, paidThrough: number, key: string): boolean {
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  return deriveKey(councilId, paidThrough) === normalized;
}

// Apply a paid unlock: raises paidThrough by FREE_LIMIT (one payment = 100 more
// registrations) and stores the key that unlocked it.
export async function applyUnlockKey(councilKey: string, key: string) {
  // councilKey = this deployment's COUNCIL_ID (from the license API route)
  const state = await getLicenseState();
  const target = state.paidThrough + FREE_LIMIT;
  if (!verifyKey(councilKey, target, key)) {
    return { ok: false as const, error: "Invalid key. Check with the system provider after payment." };
  }
  const updated = await prisma.licenseState.update({
    where: { id: councilKey },
    data: { paidThrough: target, licenseKey: key.trim().toUpperCase(), lastPaymentAt: new Date() },
  });
  return { ok: true as const, paidThrough: updated.paidThrough };
}

// Called before creating a record. Returns null if allowed; returns the
// license status if the register is locked (route returns 402 + status).
export async function assertCanCreate(): Promise<LicenseStatus | null> {
  const status = await licenseStatus();
  return status.locked ? status : null;
}