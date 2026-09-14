// GET /api/serial-preview?area=Adweso%20Town
// Shows staff the serial the NEXT record in that area will receive.
// Read-only preview — the real number is allocated transactionally on save.
import { NextRequest, NextResponse } from "next/server";
import { prisma, areaCode, councilId, formatSerial } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const area = req.nextUrl.searchParams.get("area") || "";
  const code = areaCode(area);
  if (!code) return NextResponse.json({ error: "Unknown area" }, { status: 400 });

  const counter = await prisma.serialCounter.findUnique({
    where: { councilId_electoralArea: { councilId: councilId(), electoralArea: area } },
  });
  const next = (counter?.lastNumber ?? 0) + 1;
  return NextResponse.json({ serial: formatSerial(code, next), nextNumber: next });
}