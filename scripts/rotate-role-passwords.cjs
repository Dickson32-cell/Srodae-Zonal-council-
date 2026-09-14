// ROTATION: new random passwords for all 8 council roles (old ones were
// exposed in a public repo - now dead). Writes new pws to Temp JSON + updates
// nothing else (callers apply them to .env files / Vercel separately).
const crypto = require("crypto");
const { Client } = require("pg");

async function main() {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const councils = ["adweso", "newtown", "ogua", "nkukwao", "betom", "srodae", "oldestate", "anlotown"];
  const pws = {};
  for (const cid of councils) {
    const pw = crypto.randomBytes(12).toString("base64url");
    pws[cid] = pw;
    // ALTER ROLE ... PASSWORD cannot take a parameter - interpolate a quoted literal safely
    const safe = pw.replace(/'/g, "''");
    await c.query(`ALTER ROLE zc_${cid} PASSWORD '${safe}'`);
  }
  require("fs").writeFileSync(require("path").join(process.env.LOCALAPPDATA, "Temp", "new_role_pws.json"),
    JSON.stringify(pws, null, 2));
  console.log("ALL 8 ROLE PASSWORDS ROTATED - saved to Temp/new_role_pws.json (old public ones are dead)");
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });