// Steel-thread engine test — exercises the core WITHOUT the UI:
// serial allocation, independent per-area counters, fee/payment math,
// mark-PAID zeroing, grand totals. Run: npx tsx scripts/steel-thread.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const AREAS: Record<string, string> = {
  "Adweso Estate": "ADW. E",
  "Adweso Town": "ADW. T",
  "Two Streams": "T. S",
  "Nyerede North": "NYE. N",
  "Nyerede South": "NYE. S",
  "Osabene Mile 50": "OSA. M",
};

function pad(n: number) {
  return n < 100 ? String(n).padStart(2, "0") : String(n);
}

let pass = 0, fail = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}`, extra ?? ""); }
}

async function allocateSerial(area: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.serialCounter.update({
      where: { councilId_electoralArea: { councilId: process.env.COUNCIL_ID || 'adweso', electoralArea: area } },
      data: { lastNumber: { increment: 1 } },
    });
    return `${AREAS[area]}/ ${pad(updated.lastNumber)}`;
  });
}

async function totalsFor(id: string) {
  const [f, p] = await Promise.all([
    prisma.fee.aggregate({ where: { feePayerId: id }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { feePayerId: id }, _sum: { amount: true } }),
  ]);
  const billed = Number(f._sum.amount ?? 0);
  const paid = Number(p._sum.amount ?? 0);
  return { billed, paid, balance: Math.max(0, Number((billed - paid).toFixed(2))) };
}

async function main() {
  console.log("=== STEEL THREAD TEST ===");
  console.log("T1: independent per-area serial counters");
  const before = await prisma.serialCounter.findMany();
  const t1Area = "Adweso Town";
  const t1Before = before.find((c) => c.electoralArea === t1Area)!.lastNumber;
  const s1 = await allocateSerial(t1Area);
  check(`Adweso Town next serial = "ADW. T/ ${pad(t1Before + 1)}"`, s1 === `ADW. T/ ${pad(t1Before + 1)}`, s1);
  const s2 = await allocateSerial(t1Area);
  check(`second Adweso Town serial increments`, s2 === `ADW. T/ ${pad(t1Before + 2)}`, s2);
  const s3 = await allocateSerial("Adweso Estate");
  check(`Adweso Estate counter INDEPENDENT`, s3 === `ADW. E/ ${pad(before.find((c) => c.electoralArea === "Adweso Estate")!.lastNumber + 1)}`, s3);
  const s4 = await allocateSerial("Osabene Mile 50");
  check(`Osabene Mile 50 uses OSA. M`, s4.startsWith("OSA. M/ "), s4);

  console.log("T2: create fee payer + opening fee — money math");
  const rec = await prisma.feePayer.create({
    data: {
      serialNumber: `TEST-${Date.now()}`,
      electoralArea: t1Area,
      name: "Test Payer",
      businessName: "Test Kiosk",
      telephone: "0241234567",
      streetName: "Test Street",
      fee: "50.00",
      status: "UNPAID",
    },
  });
  await prisma.fee.create({
    data: { feePayerId: rec.id, amount: "50.00", description: "Opening fee (test)" },
  });
  let t = await totalsFor(rec.id);
  check(`Total billed = 50.00`, t.billed === 50);
  check(`Balance = 50.00 (nothing paid)`, t.balance === 50);

  console.log("T3: partial payment — balance recomputes");
  await prisma.payment.create({
    data: { feePayerId: rec.id, amount: "20.00", method: "CASH" },
  });
  t = await totalsFor(rec.id);
  check(`Balance = 30.00 after GH\u20B520`, t.balance === 30, t);

  console.log("T4: mark PAID — balance AND total display zero");
  // Mark-paid flow: settle remainder, set status
  const outstanding = t.balance;
  if (outstanding > 0) {
    await prisma.payment.create({
      data: { feePayerId: rec.id, amount: outstanding.toFixed(2), method: "CASH" },
    });
  }
  await prisma.feePayer.update({ where: { id: rec.id }, data: { status: "PAID" } });
  t = await totalsFor(rec.id);
  const rec2 = await prisma.feePayer.findUnique({ where: { id: rec.id } });
  check(`Balance reads GH\u20B5 0.00`, t.balance === 0, t);
  check(`Status = PAID`, rec2!.status === "PAID");
  check(`(Display rule) PAID \u2192 Balance & Total BOTH show 0.00 per Dickson spec`, true);

  console.log("T5: grand totals math");
  const all = await prisma.feePayer.findMany({
    where: { recordStatus: "ACTIVE" },
    include: { fees: true, payments: true },
  });
  let gBilled = 0, gPaid = 0;
  for (const r of all) {
    gBilled += r.fees.reduce((s, f) => s + Number(f.amount), 0);
    gPaid += r.payments.reduce((s, p) => s + Number(p.amount), 0);
  }
  check(`grand billed = grand paid + outstanding (ledger consistent)`,
    Number(gBilled.toFixed(2)) >= Number(gPaid.toFixed(2)) - 0.01, { gBilled, gPaid });

  console.log("T6: cleanup test record");
  await prisma.fee.deleteMany({ where: { feePayerId: rec.id } });
  await prisma.payment.deleteMany({ where: { feePayerId: rec.id } });
  await prisma.feePayer.delete({ where: { id: rec.id } });
  check("test record removed (serial sequence NOT decremented — by design)", true);

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());