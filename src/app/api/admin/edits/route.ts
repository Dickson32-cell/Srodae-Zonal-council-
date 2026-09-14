// GET   /api/admin/edits — list edit requests (admin sees all; staff see own)
// PATCH /api/admin/edits — approve (apply 'after' to the record) or reject
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

type EditRow = {
  id: string;
  feePayerId: string;
  before: Record<string, string>;
  after: Record<string, string>;
  status: string;
  createdAt: Date;
  feePayer: { serialNumber: string; name: string; businessName: string };
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const edits: EditRow[] = (await prisma.pendingEdit.findMany({
    where: { councilId: councilId() },
    orderBy: { createdAt: "desc" },
    include: {
      feePayer: { select: { serialNumber: true, name: true, businessName: true } },
    },
  })) as unknown as EditRow[];

  const shaped = edits.map((e) => ({
    id: e.id,
    feePayerId: e.feePayerId,
    serial: e.feePayer.serialNumber,
    payerName: e.feePayer.name,
    businessName: e.feePayer.businessName,
    before: e.before,
    after: e.after,
    status: e.status,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({ edits: shaped });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canReviewEdits)
    return NextResponse.json({ error: "Not permitted to review edits" }, { status: 403 });

  try {
    const { editId, decision } = await req.json(); // decision: approve | reject
    if (!editId || !["approve", "reject"].includes(decision))
      return NextResponse.json({ error: "editId and decision (approve|reject) required" }, { status: 400 });

    const edit = await prisma.pendingEdit.findFirst({
      where: { id: editId, councilId: councilId() },
      include: { feePayer: true },
    });
    if (!edit) return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
    if (edit.status !== "PENDING")
      return NextResponse.json({ error: "This edit was already reviewed" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      if (decision === "approve") {
        await tx.feePayer.update({
          where: { id: edit.feePayerId },
          data: edit.after as Record<string, string>,
        });
      }
      await tx.pendingEdit.update({
        where: { id: editId },
        data: {
          status: decision === "approve" ? "APPROVED" : "REJECTED",
          reviewedBy: session.sub,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: `EDIT_${decision === "approve" ? "APPROVED" : "REJECTED"}`,
          entityType: "pending_edit",
          entityId: editId,
          details: {
            feePayerId: edit.feePayerId,
            serial: edit.feePayer.serialNumber,
            before: edit.before,
            after: edit.after,
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message:
        decision === "approve"
          ? "Edit approved and applied to the record."
          : "Edit rejected. No changes were applied.",
    });
  } catch (e) {
    console.error("admin edits error", e);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}