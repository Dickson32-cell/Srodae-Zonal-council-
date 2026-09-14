// Pre-migration backup — dumps every table to JSON via raw pg (Prisma client
// is already on the new schema, so use pg directly).
const fs = require("fs");
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL.replace(/^"|"$/g, "");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = ["fee_payer", "fee", "payment", "serial_counter", "app_user", "password_change_request", "pending_edit", "audit_log", "license_state"];
  const dump = {};
  for (const t of tables) {
    try {
      const r = await c.query(`SELECT * FROM ${t}`);
      dump[t] = r.rows;
      console.log(t, "->", r.rows.length, "rows");
    } catch (e) {
      dump[t] = { error: e.message };
      console.log(t, "-> ERROR:", e.message);
    }
  }
  fs.writeFileSync(__dirname + "/../backup-pre-multicouncil.json", JSON.stringify(dump, null, 2));
  console.log("backup written: backup-pre-multicouncil.json");
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });