// GET/POST /api/master — PRIMARY ADMIN ONLY (username 'admin').
// With the shared multi-council database, ALL councils are in this same DB,
// so the console reads every council's license state directly — no remote
// connections needed. Promoted admins/staff get 404 (invisible to them).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deriveKey, FREE_LIMIT, LICENSE_FEE_USD } from "@/lib/license";

const ALL_COUNCILS = ["adweso", "newtown", "ogua", "nkukwao", "betom", "srodae", "oldestate", "anlotown"];

// MASTER CONSOLE GATE — three conditions, ALL required:
//   1. logged in as username 'admin'
//   2. this deployment is the MASTER deployment (env MASTER_COUNCIL === COUNCIL_ID;
//      only the owner's own deployment sets MASTER_COUNCIL)
//   3. valid session
// Council deployments (Srodae etc.) have no MASTER_COUNCIL set -> 404,
// so their 'admin' sees NOTHING - the page and API do not exist for them.
async function requirePrimaryAdmin() {
  const session = await getSession();
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.username !== "admin")
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const masterCouncil = process.env.MASTER_COUNCIL;
  const thisCouncil = process.env.COUNCIL_ID;
  if (!masterCouncil || masterCouncil !== thisCouncil)
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { session };
}

export async function GET() {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  const [states, counts] = await Promise.all([
    prisma.licenseState.findMany(),
    prisma.feePayer.groupBy({
      by: ["councilId"],
      where: { recordStatus: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);
  const stateMap = new Map(states.map((s) => [s.id, s]));
  const countMap = new Map(counts.map((c) => [c.councilId, c._count._all]));

  const councils = ALL_COUNCILS.map((id) => {
    const st = stateMap.get(id);
    const paidThrough = st?.paidThrough ?? 0;
    const registered = countMap.get(id) ?? 0;
    const locked = registered >= paidThrough + FREE_LIMIT;
    return {
      councilId: id,
      registered,
      paidThrough,
      remainingFree: Math.max(0, paidThrough + FREE_LIMIT - registered),
      locked,
      lastPaymentAt: st?.lastPaymentAt ?? null,
    };
  });

  return NextResponse.json({ councils, feeUSD: LICENSE_FEE_USD });
}

export async function POST(req: NextRequest) {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  const body = await req.json().catch(() => ({}));
  if (body.action === "keygen") {
    const councilId = String(body.councilId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const paidThrough = parseInt(String(body.paidThrough ?? ""), 10);
    if (!councilId || Number.isNaN(paidThrough))
      return NextResponse.json({ error: "councilId and paidThrough required" }, { status: 400 });
    const key = deriveKey(councilId, paidThrough);
    return NextResponse.json({ ok: true, councilId, paidThrough, unlocksUpTo: paidThrough + FREE_LIMIT, key });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
