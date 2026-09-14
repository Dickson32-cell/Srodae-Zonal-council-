// POST /api/records — create a fee payer record.
// The serial number is allocated TRANSACTIONALLY (per-area counter).
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  prisma,
  ELECTORAL_AREAS,
  areaCode,
  councilId,
  formatSerial,
  getFullUser,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";
import { withRetry } from "@/lib/retry";
import { assertCanCreate } from "@/lib/license";

const PHONE_RE = /^0\d{9}$/;

type Tx = Prisma.TransactionClient;

// ATOMIC serial allocation — one single UPDATE statement, auto-committed.
// PostgreSQL serializes concurrent updates to the same row internally;
// no long-held transaction lock, so 5+ staff saving simultaneously all
// succeed. If the record insert afterwards fails, the serial is skipped
// (never reused — council register integrity).
async function allocateSerialAtomic(area: string): Promise<string> {
  const code = areaCode(area);
  if (!code) throw new Error("Unknown area");
  const updated = await prisma.serialCounter.update({
    where: { councilId_electoralArea: { councilId: councilId(), electoralArea: area } },
    data: { lastNumber: { increment: 1 } },
  });
  return formatSerial(code, updated.lastNumber);
}

// Kept for reference/rollback: transactional version (causes P2028 under load)
async function generateSerialInTx(tx: Tx, area: string): Promise<string> {
  const code = areaCode(area);
  if (!code) throw new Error("Unknown area");
  const updated = await tx.serialCounter.update({
    where: { councilId_electoralArea: { councilId: councilId(), electoralArea: area } },
    data: { lastNumber: { increment: 1 } },
  });
  return formatSerial(code, updated.lastNumber);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canCreateRecords)
    return NextResponse.json(
      { error: "Your account does not have permission to create records" },
      { status: 403 }
    );

  // LICENSE GATE: locked at every 100 registrations until the US$5 fee
  // is paid to RAMEDIC and an unlock key is applied. 402 = Payment Required.
  const license = await assertCanCreate();
  if (license)
    return NextResponse.json({ error: "REGISTER LOCKED", license }, { status: 402 });

  try {
    const body = await req.json();
    const { name, businessName, telephone, electoralArea, streetName, fee } = body;

    // Validation
    const errors: string[] = [];
    if (!name?.trim()) errors.push("Name is required");
    if (!businessName?.trim()) errors.push("Business Name is required");
    if (!telephone || !PHONE_RE.test(telephone))
      errors.push("Telephone must be 10 digits starting with 0 (e.g. 0241234567)");
    if (!ELECTORAL_AREAS.some((a) => a.area === electoralArea))
      errors.push("Electoral Area is invalid");
    if (!streetName?.trim()) errors.push("Street Name is required");
    const feeNum = Number(fee);
    if (!Number.isFinite(feeNum) || feeNum <= 0)
      errors.push("Fee must be a positive amount in GH\u20B5");

    // GPS (optional) — Ghana bounding box keeps typos/garbage out
    let lat: number | null = null;
    let lng: number | null = null;
    if (body.latitude != null && body.longitude != null) {
      lat = Number(body.latitude);
      lng = Number(body.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < 4.4 || lat > 11.5 || lng < -3.6 || lng > 1.8) {
        errors.push("GPS coordinates look invalid (must be within Ghana)");
      }
    }
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    // Concurrency-safe create:
    // 1. ATOMIC serial allocation (single UPDATE — row lock held for
    //    microseconds, so 5+ staff at once never block each other into
    //    transaction timeouts)
    // 2. Short transaction for record + fee + audit (withRetry absorbs
    //    Neon transient connection errors)
    const serial = await withRetry(() => allocateSerialAtomic(electoralArea), "allocate-serial");

    const record = await withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.feePayer.create({
            data: {
              councilId: councilId(),
              serialNumber: serial,
              electoralArea,
              name: name.trim(),
              businessName: businessName.trim(),
              telephone,
              streetName: streetName.trim(),
              latitude: lat != null ? lat.toFixed(7) : null,
              longitude: lng != null ? lng.toFixed(7) : null,
              fee: feeNum.toFixed(2),
              status: "UNPAID",
            },
          });

          // Opening billing entry (the typed fee) — keeps the ledger truthful
          await tx.fee.create({
            data: {
              councilId: councilId(),
              feePayerId: created.id,
              amount: feeNum.toFixed(2),
              description: "Opening fee (temporal structure)",
              createdBy: session.sub,
            },
          });

          await tx.auditLog.create({
            data: {
              councilId: councilId(),
              userId: session.sub,
              action: "CREATE_RECORD",
              entityType: "fee_payer",
              entityId: created.id,
              details: { serial, name, businessName, electoralArea, fee: feeNum },
            },
          });

          return created;
        }),
      "create-record"
    );

    return NextResponse.json({
      ok: true,
      record: {
        id: record.id,
        serialNumber: record.serialNumber,
        name: record.name,
        businessName: record.businessName,
        telephone: record.telephone,
        electoralArea: record.electoralArea,
        streetName: record.streetName,
        latitude: record.latitude ? Number(record.latitude) : null,
        longitude: record.longitude ? Number(record.longitude) : null,
        fee: Number(record.fee),
        status: record.status,
        balance: Number(record.fee),
        total: Number(record.fee),
      },
    });
  } catch (e) {
    console.error("create record error", e);
    return NextResponse.json({ error: "Could not create record" }, { status: 500 });
  }
}