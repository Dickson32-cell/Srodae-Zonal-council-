// Middleware — defense-in-depth token check on API routes.
// The per-route getSession() checks remain the primary guard; this adds a
// cheap pre-filter at the edge for obvious unauthenticated traffic.
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "adweso_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "adweso-zonal-council-temporal-structures-2026-session-key"
);

const PUBLIC = ["/api/auth/login", "/api/auth/register", "/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await jwtVerify(token, secret);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};