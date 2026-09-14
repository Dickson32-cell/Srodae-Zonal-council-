// GET   /api/admin/passwords — list password change requests
// PATCH /api/admin/passwords — approve (applies the stored hash) or reject
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canReviewPasswords)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const requests = await prisma.passwordChangeRequest.findMany({
    where: { councilId: councilId() },
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { username: true, fullName: true, active: true } } },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      username: r.user.username,
      fullName: r.user.fullName,
      accountActive: r.user.active,
      status: r.status,
      requestedAt: r.requestedAt,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canReviewPasswords)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  try {
    const { requestId, decision } = await req.json(); // approve | reject
    if (!requestId || !["approve", "reject"].includes(decision))
      return NextResponse.json({ error: "requestId and decision required" }, { status: 400 });

    const reqRow = await prisma.passwordChangeRequest.findFirst({
      where: { id: requestId, councilId: councilId() },
    });
    if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (reqRow.status !== "PENDING")
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      if (decision === "approve") {
        await tx.appUser.update({
          where: { id: reqRow.userId },
          data: { passwordHash: reqRow.newHash },
        });
      }
      await tx.passwordChangeRequest.update({
        where: { id: requestId },
        data: {
          status: decision === "approve" ? "APPROVED" : "REJECTED",
          reviewedBy: me.id,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: me.id,
          action: `PASSWORD_${decision === "approve" ? "APPROVED" : "REJECTED"}`,
          entityType: "app_user",
          entityId: reqRow.userId,
          details: {},
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: decision === "approve" ? "Password change approved and applied." : "Password change rejected.",
    });
  } catch (e) {
    console.error("admin passwords error", e);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}