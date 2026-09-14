// POST /api/auth/register — STAFF SELF-REGISTRATION.
// Creates an INACTIVE account; admin must approve before login works.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, councilId, audit } from "@/lib/db";
import { loginRateCheck } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, fullName } = body;

    const errors: string[] = [];
    if (!username || !/^[a-zA-Z0-9._-]{3,30}$/.test(username))
      errors.push("Username must be 3-30 characters (letters, numbers, . _ -)");
    if (!password || password.length < 8)
      errors.push("Password must be at least 8 characters");
    if (!fullName?.trim() || fullName.trim().length < 3)
      errors.push("Full name is required");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = loginRateCheck(`reg|${ip}`);
    if (!rl.ok)
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInMin} minutes.` },
        { status: 429 }
      );

    const existing = await prisma.appUser.findUnique({
      where: { councilId_username: { councilId: councilId(), username } },
    });
    if (existing)
      return NextResponse.json(
        { errors: ["That username is already taken"] },
        { status: 400 }
      );

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.appUser.create({
      data: {
        councilId: councilId(),
        username,
        passwordHash: hash,
        fullName: fullName.trim(),
        role: "STAFF",
        active: false, // INACTIVE until admin approves
      },
    });

    await audit(null, "STAFF_REGISTERED", "app_user", user.id, {
      username,
      fullName,
      ip,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Registration received. An administrator must approve your account before you can sign in.",
    });
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}