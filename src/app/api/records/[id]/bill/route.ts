// GET /api/records/[id]/bill — bill data for the printable Assembly-style bill.
// Returns everything the bill page needs; BOP stays 0 until a mandate says otherwise.
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { COUNCIL_NAMES } from "@/lib/councils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const r = await prisma.feePayer.findFirst({
    where: { id, councilId: councilId(), recordStatus: "ACTIVE" },
    include: {
      fees: { orderBy: { billedAt: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billed = r.fees.reduce((s, f) => s + Number(f.amount), 0);
  const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = r.status === "PAID" ? 0 : Math.max(0, Number((billed - paid).toFixed(2)));

  const cid = councilId();
  return NextResponse.json({
    councilId: cid,
    councilName: COUNCIL_NAMES[cid] ?? "Zonal Council",
    customer: {
      id: r.serialNumber,
      name: r.name,
      businessName: r.businessName,
      telephone: r.telephone,
      electoralArea: r.electoralArea,
      streetName: r.streetName,
    },
    bill: {
      structureRate: Number(r.fee.toFixed(2)),
      bop: null, // BOP not collected by zonal councils yet — placeholder until mandate
      basicRate: 1.0,
      rent: 0,
      arrears: 0,
      payment: Number(paid.toFixed(2)),
      totalDue,
      status: r.status,
      description: r.businessName || r.name,
    },
    printedOn: new Date().toISOString(),
  });
}