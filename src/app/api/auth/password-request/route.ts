// POST /api/auth/password-request — user requests their own password change.
// The new password is stored HASHED and applied only after admin approval.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, councilId, audit } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await req.json();
    const errors: string[] = [];
    if (!newPassword || newPassword.length < 8)
      errors.push("New password must be at least 8 characters");
    if (!currentPassword) errors.push("Current password is required");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const user = await prisma.appUser.findUnique({ where: { id: session.sub } });
    if (!user || !user.active)
      return NextResponse.json({ error: "Account unavailable" }, { status: 401 });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok)
      return NextResponse.json({ errors: ["Current password is incorrect"] }, { status: 400 });

    // Only one pending request per user — replace any existing pending
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.passwordChangeRequest.updateMany({
        where: { userId: user.id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await tx.passwordChangeRequest.create({
        data: { councilId: councilId(), userId: user.id, newHash: hash, status: "PENDING" },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_CHANGE_REQUESTED",
          entityType: "app_user",
          entityId: user.id,
          details: { username: user.username },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: "Password change submitted. An administrator must approve it before it takes effect.",
    });
  } catch (e) {
    console.error("password-request error", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}