// POST /api/auth/login — username + bcrypt, httpOnly session cookie
// Rate-limited: 5 attempts per username+IP per 15 minutes.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, councilId, createSessionToken, audit } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { loginRateCheck, loginRateClear } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    // Brute-force protection
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlKey = `${String(username).toLowerCase()}|${ip}`;
    const rl = loginRateCheck(rlKey);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInMin} minutes.` },
        { status: 429 }
      );
    }

    const user = await prisma.appUser.findUnique({
      where: { councilId_username: { councilId: councilId(), username } },
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    loginRateClear(rlKey);

    const token = await createSessionToken(user.id, user.username, user.role);
    await audit(user.id, "LOGIN", "app_user", user.id, { username });

    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, fullName: user.fullName, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}