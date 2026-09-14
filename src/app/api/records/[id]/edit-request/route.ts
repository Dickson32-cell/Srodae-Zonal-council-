// POST /api/records/[id]/edit-request — staff propose identity-field edits.
// Nothing changes on the record yet; the request waits for admin approval.
// Admin edits applied directly via PATCH /api/records/[id] still work.
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, audit } from "@/lib/db";
import { getSession } from "@/lib/auth";

const EDITABLE = ["name", "businessName", "telephone", "streetName", "electoralArea"] as const;
const PHONE_RE = /^0\d{9}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const payer = await prisma.feePayer.findFirst({ where: { id, councilId: councilId() } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });

    // Collect only the fields the user actually changed
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    const errors: string[] = [];

    for (const f of EDITABLE) {
      const incoming = body[f];
      if (typeof incoming !== "string" || !incoming.trim()) continue;
      const current = String((payer as unknown as Record<string, unknown>)[f]);
      if (incoming.trim() === current) continue; // unchanged — skip
      before[f] = current;
      after[f] = incoming.trim();
      if (f === "telephone" && !PHONE_RE.test(incoming.trim()))
        errors.push("Telephone must be 10 digits starting with 0");
    }
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    if (Object.keys(after).length === 0)
      return NextResponse.json({ errors: ["No changes were made"] }, { status: 400 });

    const pending = await prisma.$transaction(async (tx) => {
      const created = await tx.pendingEdit.create({
        data: {
          feePayerId: id,
          before: before as object,
          after: after as object,
          status: "PENDING",
          requestedBy: session.sub,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: "EDIT_REQUESTED",
          entityType: "pending_edit",
          entityId: created.id,
          details: { feePayerId: id, serial: payer.serialNumber, before, after },
        },
      });
      return created;
    });

    return NextResponse.json({
      ok: true,
      editId: pending.id,
      message: "Edit submitted for administrator approval. No changes applied yet.",
    });
  } catch (e) {
    console.error("edit-request error", e);
    return NextResponse.json({ error: "Could not submit edit" }, { status: 500 });
  }
}