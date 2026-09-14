// GET  /api/admin/users — list all users (admin only)
// PATCH /api/admin/users — approve/reject/deactivate/reactivate/makeAdmin/setAdminLevel/delete
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ADMIN_LEVELS, AdminLevel, permsFor } from "@/lib/perms";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });

    const users = await prisma.appUser.findMany({
    where: { councilId: councilId() },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, username: true, fullName: true,
      role: true, adminLevel: true, active: true, createdAt: true,
    },
  });

  // Records created per user (from the audit trail)
  const counts = await prisma.auditLog.groupBy({
    by: ["userId"],
    where: { action: "CREATE_RECORD", councilId: councilId(), userId: { not: null } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.userId, c._count._all]));

  return NextResponse.json({
    users: users.map((u) => ({ ...u, recordsCreated: countMap.get(u.id) ?? 0 })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted to manage staff" }, { status: 403 });

  try {
    const body = await req.json();
    const { userId, action } = body;
    if (!userId || !action)
      return NextResponse.json({ error: "userId and action required" }, { status: 400 });

    const target = await prisma.appUser.findFirst({ where: { id: userId, councilId: councilId() } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.username === "admin" && action !== "deactivate" && action !== "reactivate")
      return NextResponse.json(
        { error: "The primary admin account cannot be modified this way" },
        { status: 400 }
      );
    if (target.id === session.sub && (action === "deactivate"))
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );

    let data: Record<string, unknown> = {};
    switch (action) {
      case "approve": data = { active: true, role: "STAFF", adminLevel: null }; break;
      case "makeAdmin":
        data = {
          active: true,
          role: "ADMIN",
          adminLevel: ADMIN_LEVELS.includes(body.adminLevel as AdminLevel)
            ? body.adminLevel
            : "EDITOR", // default to EDITOR when not specified
        };
        break;
      case "setAdminLevel":
        if (!ADMIN_LEVELS.includes(body.adminLevel as AdminLevel))
          return NextResponse.json({ error: "Invalid admin level" }, { status: 400 });
        if (target.username === "admin")
          return NextResponse.json({ error: "The primary admin is always FULL" }, { status: 400 });
        data = { adminLevel: body.adminLevel };
        break;
      case "reject":
      case "deactivate": data = { active: false }; break;
      case "reactivate": data = { active: true }; break;
      case "delete":
        // Real deletion — admin only, never self, never primary admin.
        if (target.username === "admin")
          return NextResponse.json({ error: "The primary admin account cannot be deleted" }, { status: 400 });
        if (target.id === me.id)
          return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
        await prisma.$transaction(async (tx) => {
          await tx.auditLog.updateMany({ where: { userId: target.id }, data: { userId: null } });
          await tx.auditLog.updateMany({ where: { entityId: target.id }, data: { entityId: null } });
          await tx.pendingEdit.updateMany({ where: { requestedBy: target.id }, data: { status: "REJECTED" } });
          await tx.appUser.delete({ where: { id: target.id } });
          await tx.auditLog.create({
            data: {
              userId: me.id,
              action: "USER_DELETED",
              entityType: "app_user",
              entityId: null,
              details: { deletedUsername: target.username, deletedFullName: target.fullName },
            },
          });
        });
        return NextResponse.json({ ok: true, deleted: target.username });
      case "demoteToStaff":
        if (target.username === "admin")
          return NextResponse.json({ error: "The primary admin cannot be demoted" }, { status: 400 });
        data = { role: "STAFF", adminLevel: null };
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.appUser.update({ where: { id: userId }, data });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: `USER_${String(action).toUpperCase()}`,
          entityType: "app_user",
          entityId: userId,
          details: { targetUsername: target.username, before: { active: target.active, role: target.role } },
        },
      });
      return u;
    });

    return NextResponse.json({
      ok: true,
      user: { id: updated.id, username: updated.username, role: updated.role, active: updated.active },
    });
  } catch (e) {
    console.error("admin users error", e);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}