
// CONCURRENCY PROOF: 8 parallel saves across 2 councils in one shared DB.
// Must produce: 4 adweso serials NT-free (ADW. T/ 04..07), 4 newtown serials
// (NT/ 01..04), zero duplicates, zero cross-contamination.
const { PrismaClient } = require("@prisma/client");
const adweso = new PrismaClient({ datasources: { db: { url: process.env.URL_A } } });
const newtown = new PrismaClient({ datasources: { db: { url: process.env.URL_N } } });

async function create(client, council, area, code, name) {
  // atomic serial alloc + create (mirrors the API route's allocateSerialAtomic)
  const upd = await client.serialCounter.update({
    where: { councilId_electoralArea: { councilId: council, electoralArea: area } },
    data: { lastNumber: { increment: 1 } },
  });
  const n = upd.lastNumber;
  const serial = code + "/ " + String(n < 100 ? String(n).padStart(2, "0") : n);
  const rec = await client.feePayer.create({
    data: { councilId: council, serialNumber: serial, electoralArea: area,
            name: name, businessName: "CC Test", telephone: "0240000099",
            streetName: "Test St", fee: "100.00", status: "UNPAID" },
  });
  return serial;
}

(async () => {
  const jobs = [];
  for (let i = 0; i < 4; i++) {
    jobs.push(create(adweso, "adweso", "Adweso Town", "ADW. T", "CC Adweso " + i));
    jobs.push(create(newtown, "newtown", "New Town", "NT", "CC Newtown " + i));
  }
  const serials = await Promise.all(jobs);
  const adwesoSerials = serials.filter((_, i) => i % 2 === 0).sort();
  const newtownSerials = serials.filter((_, i) => i % 2 === 1).sort();
  console.log("adweso serials:", adwesoSerials.join(", "));
  console.log("newtown serials:", newtownSerials.join(", "));
  const dupes = serials.filter((s, i) => serials.indexOf(s) !== i);
  console.log("duplicate serials WITHIN council:", dupes.filter(s => s.startsWith("ADW") || s.startsWith("NT")).length ? dupes : "NONE");
  // cross-check: newtown client must not see adweso records
  const nSeen = await newtown.feePayer.count({ where: { councilId: "adweso" } });
  console.log("newtown connection sees adweso records:", nSeen, "(MUST be 0)");
  await adweso.$disconnect(); await newtown.$disconnect();
})().catch((e) => { console.error("CONCURRENCY TEST FAILED:", e.message); process.exit(1); });
