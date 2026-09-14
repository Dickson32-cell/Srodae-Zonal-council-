// Middleware — defense-in-depth token check on API routes.
// The per-route getSession() checks remain the primary guard; this adds a
// cheap pre-filter at the edge for obvious unauthenticated traffic.
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "adweso_session";

const PUBLIC = ["/api/auth/login", "/api/auth/register", "/login", "/register"];

// EDGE NOTE: signature verification is NOT done here. Next.js middleware runs
// on the edge runtime where env vars may not be inlined, so verifying with the
// session secret here caused 401s when the deployed secret differed from the
// build-time fallback. This layer now only blocks cookie-less requests (cheap
// gate); every API route performs its own full signature verification with
// getSession() - the real security check happens there, with correct env access.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};