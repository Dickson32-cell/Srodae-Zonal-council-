#!/usr/bin/env node
// CLONE TOOL — creates a new zonal-council project folder from the Adweso
// source: rebrand strings, serial codes, seed areas, env. Usage:
//   node scripts/clone-council.cjs "<destFolder>" "<councilName>" "<areaName:CODE> ..."
// Example:
//   node scripts/clone-council.cjs "E:/New Town Zonal Council/newtown-register" \
//     "New Town Zonal Council" "New Town:NT" "..."
const fs = require("fs");
const path = require("path");

const [dest, councilName, ...areas] = process.argv.slice(2);
if (!dest || !councilName || areas.length === 0) {
  console.error('Usage: node clone-council.cjs "<destFolder>" "<Council Name>" "Area:CODE" ...');
  process.exit(1);
}

const SRC = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel", ".env"]);
const COUNCIL_ID = councilName.toLowerCase().replace(/[^a-z0-9]+/g, "").replace("zonalcouncil", "");

function walk(dir, base = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const from = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(from, rel);
    else files.push(rel);
  }
}
const files = [];
walk(SRC);

fs.mkdirSync(dest, { recursive: true });
for (const rel of files) {
  const to = path.join(dest, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), to);
}

// ---- rebrand text files ----
const AREA_LINES = areas.map(a => `  { area: "${a.split(":")[0]}", code: "${a.split(":")[1]}" },`).join("\n");
const AREA_TSLIST = areas.map(a => `  "${a.split(":")[0]}",`).join("\n");
const rebrand = (rel) => {
  const p = path.join(dest, rel);
  let s = fs.readFileSync(p, "utf-8");
  if (rel.endsWith("db.ts")) {
    s = s.replace(/\{ area: "[^"]+",\s*code: "[^"]+" \},\s*\/\/ Adweso[\s\S]*?\] as const;/, `${AREA_LINES}\n] as const; // council areas`)
         .replace(/const ELECTORAL_AREAS = \[[\s\S]*?\] as const;/, `const ELECTORAL_AREAS = [\n${AREA_LINES}\n] as const;`);
  }
  s = s.split("Adweso Zonal Council").join(councilName);
  s = s.split("ADWESO ZONAL COUNCIL").join(councilName.toUpperCase());
  if (rel.endsWith("seed.js")) {
    s = s.replace(/const AREAS = \[[\s\S]*?\];/, `const AREAS = [\n${AREA_TSLIST.replace(/"/g, '"').split("\n").map(l => l.trim()).filter(Boolean).map(l => `  { area: ${l} },`).join("\n")}\n];`);
  }
  fs.writeFileSync(p, s);
};
for (const rel of files) if (/\.(ts|tsx|js|json|md|css)$/.test(rel)) rebrand(rel);

// ---- seed AREAS rebrand (seed uses plain area strings) ----
const seedP = path.join(dest, "prisma", "seed.js");
if (fs.existsSync(seedP)) {
  let s = fs.readFileSync(seedP, "utf-8");
  const block = areas.map(a => `  { area: "${a.split(":")[0]}" },`).join("\n");
  s = s.replace(/const AREAS = \[[\s\S]*?\];/, `const AREAS = [\n${block}\n];`);
  s = s.replace(/Abdul Rashid Dickson/, "Council Administrator");
  fs.writeFileSync(seedP, s);
}

// ---- env template ----
fs.writeFileSync(path.join(dest, ".env.example"),
`DATABASE_URL=""        # create a Neon database for this council
SESSION_SECRET="$(COUNCIL_ID)-session-CHANGE-ME"
COUNCIL_ID="${COUNCIL_ID}"
LICENSE_SECRET="<your-license-secret>"
ADMIN_PASSWORD=""
`);

console.log(`Cloned to ${dest}`);
console.log(`Council: ${councilName} | COUNCIL_ID: ${COUNCIL_ID}`);
console.log(`Areas: ${areas.map(a => a.split(":")[0] + " (" + a.split(":")[1] + ")").join(", ")}`);
console.log("Next steps: create Neon DB -> set .env -> npx prisma db push -> node prisma/seed.js -> npm run build -> deploy");