#!/usr/bin/env node
// KEY GENERATOR (owner tool) — run when a council pays their US$5.
// Usage:   node scripts/make-license-key.cjs <councilId> <paidThrough>
// Example: node scripts/make-license-key.cjs newtown 100
//   -> prints the key that unlocks paidThrough=100 (registrations 101-200).
// The same LICENSE_SECRET must be set in the council deployment's .env.
// Read the council's CURRENT paidThrough from their /api/license or DB first;
// the key is only valid for paidThrough+100.
const crypto = require("crypto");

const [councilId, paidThroughRaw] = process.argv.slice(2);
if (!councilId || !paidThroughRaw) {
  console.error("Usage: node make-license-key.cjs <councilId> <paidThroughNumber>");
  console.error("Example: node make-license-key.cjs newtown 100");
  process.exit(1);
}
const paidThrough = parseInt(paidThroughRaw, 10);
const secret = process.env.LICENSE_SECRET;
if (!secret) {
  console.error("LICENSE_SECRET env var required (same value as the council deployment).");
  process.exit(1);
}
const mac = crypto.createHmac("sha256", secret)
  .update(`${councilId}:${paidThrough}`)
  .digest("hex").slice(0, 16).toUpperCase();
const key = mac.replace(/(.{4})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4");
console.log(`Council: ${councilId} | unlocks registrations up to ${paidThrough + 100}`);
console.log(`KEY: ${key}`);