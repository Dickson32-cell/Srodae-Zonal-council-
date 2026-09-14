// PATCH /api/records/[id] — edit identity fields, or select status PAID.
// Admin (FULL/EDITOR) only — staff use the edit-request workflow.
// Marking PAID auto-writes a settlement payment for the outstanding remainder,
// so Balance AND Total both read GH₵ 0.00 (Dickson's confirmed behaviour)
// while the cash ledger stays truthful.
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, payerTotals, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

const PHONE_RE = /^0\d{9}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canEditRecords)
    return NextResponse.json(
      { error: "Your account cannot edit records directly" },
      { status: 403 }
    );

  const { id } = await params;
  try {
    const body = await req.json();
    const payer = await prisma.feePayer.findFirst({ where: { id, councilId: councilId() } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });

    // --- Case 1: staff selects "PAID" → settle in full ---
    if (body.status === "PAID") {
      const totals = await payerTotals(id);
      const outstanding = Number(totals.balance.toFixed(2));
      if (payer.status === "PAID") {
        return NextResponse.json({ ok: true, alreadyPaid: true, totals });
      }
      await prisma.$transaction(async (tx) => {
        if (outstanding > 0) {
          await tx.payment.create({
            data: {
              feePayerId: id,
              amount: outstanding.toFixed(2),
              method: "CASH",
              receivedBy: session.sub,
              receiptNo: body.receiptNo || null,
            },
          });
        }
        await tx.feePayer.update({ where: { id }, data: { status: "PAID" } });
        await tx.auditLog.create({
          data: {
            userId: session.sub,
            action: "MARK_PAID",
            entityType: "fee_payer",
            entityId: id,
            details: { settled: outstanding },
          },
        });
      });
      const after = await payerTotals(id);
      return NextResponse.json({ ok: true, totals: after, status: "PAID" });
    }

    // --- Case 2: revert to UNPAID (admin correction) ---
    if (body.status === "UNPAID") {
      await prisma.$transaction(async (tx) => {
        await tx.feePayer.update({ where: { id }, data: { status: "UNPAID" } });
        await tx.auditLog.create({
          data: {
            userId: session.sub,
            action: "MARK_UNPAID",
            entityType: "fee_payer",
            entityId: id,
            details: {},
          },
        });
      });
      const after = await payerTotals(id);
      return NextResponse.json({ ok: true, totals: after, status: "UNPAID" });
    }

    // --- Case 3: edit identity fields ---
    const errors: string[] = [];
    if (body.telephone && !PHONE_RE.test(body.telephone))
      errors.push("Telephone must be 10 digits starting with 0");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const data: Record<string, string> = {};
    for (const f of ["name", "businessName", "telephone", "streetName", "electoralArea"]) {
      if (typeof body[f] === "string" && body[f].trim()) data[f] = body[f].trim();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.feePayer.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: "UPDATE_RECORD",
          entityType: "fee_payer",
          entityId: id,
          details: { before: { ...payer }, after: { ...r } },
        },
      });
      return r;
    });

    const totals = await payerTotals(id);
    return NextResponse.json({ ok: true, record: updated, totals });
  } catch (e) {
    console.error("update record error", e);
    return NextResponse.json({ error: "Could not update record" }, { status: 500 });
  }
}