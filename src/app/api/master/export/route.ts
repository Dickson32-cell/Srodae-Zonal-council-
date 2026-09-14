// GET /api/master/export — PRIMARY ADMIN ONLY (username 'admin').
// One Excel workbook with EVERY council's complete register + payments
// from the shared multi-council database. Only the primary admin sees this.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const GHS = (n: number) => n.toFixed(2);
const ALL_COUNCILS = ["adweso", "newtown", "ogua", "nkukwao", "betom", "srodae", "oldestate", "anlotown"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.username !== "admin")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const masterCouncil = process.env.MASTER_COUNCIL;
  if (!masterCouncil || masterCouncil !== process.env.COUNCIL_ID)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payers = await prisma.feePayer.findMany({
    orderBy: [{ councilId: "asc" }, { serialNumber: "asc" }],
    include: { payments: { orderBy: { receivedAt: "asc" }, include: { receivedByUser: { select: { username: true } } } } },
  });

  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];
  for (const c of ALL_COUNCILS) {
    const rows = payers.filter((p) => p.councilId === c);
    if (!rows.length) continue;
    const register = rows.map((p) => {
      const paid = p.payments.reduce((s, x) => s + Number(x.amount), 0);
      const fee = Number(p.fee);
      const balance = p.status === "PAID" ? 0 : Math.max(0, fee - paid);
      return {
        "Serial": p.serialNumber, "Area": p.electoralArea, "Name": p.name,
        "Business": p.businessName, "Telephone": p.telephone, "Street": p.streetName,
        "GPS": p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : "",
        "Fee (GHs)": GHS(fee), "Status": p.status, "Record": p.recordStatus,
        "Registered": p.createdAt.toISOString().slice(0, 10),
        "Paid total": GHS(paid), "Balance": GHS(balance),
      };
    });
    const payments = rows.flatMap((p) =>
      p.payments.map((x) => ({
        "Serial": p.serialNumber,
        "Date": x.receivedAt.toISOString().slice(0, 10),
        "Amount (GHs)": GHS(Number(x.amount)),
        "Kind": x.receiptNo === "SETTLEMENT" ? "SETTLEMENT" : x.method,
        "Recorded by": x.receivedByUser?.username ?? "-",
      }))
    );
    sheets.push({ name: `${c} register`, rows: register });
    sheets.push({ name: `${c} payments`, rows: payments });
  }

  const summary = sheets
    .filter((s) => s.name.endsWith(" register"))
    .map((s) => {
      const active = s.rows.filter((r) => r.Record === "ACTIVE");
      const billed = active.reduce((t, r) => t + Number(r["Fee (GHs)"]), 0);
      const collected = active.reduce((t, r) => t + Number(r["Paid total"]), 0);
      return {
        "Council": s.name.replace(" register", ""),
        "Active records": active.length,
        "Total records": s.rows.length,
        "Billed (GHs)": GHS(billed), "Collected (GHs)": GHS(collected), "Outstanding (GHs)": GHS(billed - collected),
      };
    });

  const wb = XLSX.utils.book_new();
  if (summary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="All-Councils-Register-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
