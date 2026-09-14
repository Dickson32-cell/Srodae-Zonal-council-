// Seed: serial counters for the 6 electoral areas + first admin user
// Run: npx tsx prisma/seed.ts   (or) node prisma/seed.mjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const AREAS = [
  { area: "Social Welfare", code: "S. W" },
  { area: "Central Market", code: "C. M" },
  { area: "Debrakrom", code: "DBK" },
  { area: "Akwaasu Asebi", code: "AK. A" },
  { area: "Kantudu", code: "KTD" },
];

async function main() {
  // Serial counters — one per area, starting at 0 (next = 01)
  const COUNCIL = process.env.COUNCIL_ID || "adweso";
  for (const { area } of AREAS) {
    await prisma.serialCounter.upsert({
      where: { councilId_electoralArea: { councilId: COUNCIL, electoralArea: area } },
      update: {},
      create: { councilId: COUNCIL, electoralArea: area, lastNumber: 0 },
    });
  }
  const counters = await prisma.serialCounter.findMany({ orderBy: { electoralArea: "asc" } });
  console.log("serial_counter rows:", counters.length);
  counters.forEach((c) => console.log("  ", c.electoralArea, "-> next:", c.lastNumber + 1));

  // First admin (Dickson). Password comes ONLY from ADMIN_PASSWORD env var.
  // If not set, a random one is generated and printed ONCE to the console.
  const adminPassword = process.env.ADMIN_PASSWORD || require("crypto").randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.appUser.upsert({
    where: { councilId_username: { councilId: COUNCIL, username: "admin" } },
    update: {},
    create: {
      councilId: COUNCIL,
      username: "admin",
      passwordHash: hash,
      fullName: "Council Administrator",
      role: "ADMIN",
      active: true,
    },
  });
  await prisma.licenseState.upsert({
    where: { id: COUNCIL },
    update: {},
    create: { id: COUNCIL, paidThrough: 0 },
  });
  console.log("admin user ready:", admin.username, "(" + admin.role + ")");
  console.log("ADMIN_PASSWORD was:", adminPassword ? "[set via env]" : "[random — copy from below]");
  if (!process.env.ADMIN_PASSWORD) console.log(">>> ADMIN PASSWORD (SAVE NOW, shown once):", adminPassword);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());