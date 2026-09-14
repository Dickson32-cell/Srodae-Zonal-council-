// POST /api/records/[id]/payments — record a cash payment (partial or full)
// PATCH semantics kept simple: this endpoint only ADDS cash received.
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, payerTotals, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canRecordPayments)
    return NextResponse.json(
      { error: "Your account cannot record payments" },
      { status: 403 }
    );

  const { id } = await params;
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ errors: ["Amount must be a positive number"] }, { status: 400 });

    const payer = await prisma.feePayer.findFirst({ where: { id, councilId: councilId() } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const totals = await payerTotals(id);
    if (amount > totals.balance + 0.001) {
      return NextResponse.json(
        { errors: [`Payment exceeds outstanding balance (GH\u20B5 ${totals.balance.toFixed(2)})`] },
        { status: 400 }
      );
    }

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          feePayerId: id,
          amount: amount.toFixed(2),
          method: "CASH",
          receiptNo: body.receiptNo || null,
          receivedBy: session.sub,
        },
      });
      // If this payment clears the balance, flip status to PAID
      const newBalance = Number((totals.balance - amount).toFixed(2));
      if (newBalance <= 0.009) {
        await tx.feePayer.update({ where: { id }, data: { status: "PAID" } });
      }
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: "RECORD_PAYMENT",
          entityType: "payment",
          entityId: created.id,
          details: { feePayerId: id, amount, newBalance },
        },
      });
      return created;
    });

    const after = await payerTotals(id);
    const updated = await prisma.feePayer.findFirst({ where: { id, councilId: councilId() } });
    return NextResponse.json({
      ok: true,
      payment: { id: payment.id, amount: Number(payment.amount) },
      totals: after,
      status: updated?.status,
    });
  } catch (e) {
    console.error("payment error", e);
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }
}