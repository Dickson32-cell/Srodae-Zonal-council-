// GET  /api/license — current license status (any logged-in user)
// POST /api/license — submit an unlock key (any logged-in user; key itself
//                     is the authority — it only works if genuinely issued)
import { NextRequest, NextResponse } from "next/server";
import { licenseStatus, applyUnlockKey } from "@/lib/license";
import { getSession } from "@/lib/auth";

// Council identity — set per deployment via env so each clone is distinct
const COUNCIL_ID = process.env.COUNCIL_ID || "adweso";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await licenseStatus());
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await req.json().catch(() => ({ key: "" }));
  if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });
  const result = await applyUnlockKey(COUNCIL_ID, String(key));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true, paidThrough: result.paidThrough, status: await licenseStatus() });
}