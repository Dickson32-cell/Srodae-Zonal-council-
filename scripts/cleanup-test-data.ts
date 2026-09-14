// Cleanup: remove all test records created during verification.
// Serial counters are NOT reset (by design — they only move forward),
// so the council's first real record gets the next number in sequence.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Test records created via the HTTP steel thread + engine test
  const testNames = ["Test Payer", "Ama Serwaa", "Kofi Mensah", "Adjoa Boateng", "Yaw Darko", "X"];
  let removed = 0;
  for (const name of testNames) {
    const rows = await prisma.feePayer.findMany({ where: { name } });
    for (const r of rows) {
      await prisma.fee.deleteMany({ where: { feePayerId: r.id } });
      await prisma.payment.deleteMany({ where: { feePayerId: r.id } });
      await prisma.feePayer.delete({ where: { id: r.id } });
      removed++;
      console.log("removed:", r.serialNumber, "-", r.name);
    }
  }

  // Also catch anything with a TEST- prefix serial from the engine test
  const testSerials = await prisma.feePayer.findMany({
    where: { serialNumber: { startsWith: "TEST-" } },
  });
  for (const r of testSerials) {
    await prisma.fee.deleteMany({ where: { feePayerId: r.id } });
    await prisma.payment.deleteMany({ where: { feePayerId: r.id } });
    await prisma.feePayer.delete({ where: { id: r.id } });
    removed++;
    console.log("removed:", r.serialNumber, "-", r.name);
  }

  // What remains must be zero records
  const remaining = await prisma.feePayer.count();
  const fees = await prisma.fee.count();
  const pays = await prisma.payment.count();
  console.log(`\nremoved ${removed} test records`);
  console.log(`remaining: ${remaining} fee_payers, ${fees} fees, ${pays} payments`);

  // Show counter state (forward-only by design)
  const counters = await prisma.serialCounter.findMany({ orderBy: { electoralArea: "asc" } });
  console.log("\ncounters (next number per area — forward only):");
  counters.forEach((c) => console.log(`  ${c.electoralArea}: next ${c.lastNumber + 1}`));

  if (remaining !== 0) throw new Error("CLEANUP INCOMPLETE");
  console.log("\nCLEANUP COMPLETE — production register is empty and ready");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());