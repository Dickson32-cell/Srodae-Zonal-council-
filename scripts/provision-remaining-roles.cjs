// One-time provisioning: real passwords for the 6 remaining council roles
// + serial counters for all councils' areas.
const { Client } = require("pg");

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });
  await c.connect();

  // passwords come from env vars, never committed:
  // PW_OGUA, PW_NKUKWAO, PW_BETOM, PW_SRODAE, PW_OLDESTATE, PW_ANLOTOWN
  const pws = {
    ogua: process.env.PW_OGUA, nkukwao: process.env.PW_NKUKWAO, betom: process.env.PW_BETOM,
    srodae: process.env.PW_SRODAE, oldestate: process.env.PW_OLDESTATE, anlotown: process.env.PW_ANLOTOWN,
  };
  for (const [cid, pw] of Object.entries(pws)) {
    if (!pw) { console.error('Missing env PW_' + cid.toUpperCase()); process.exit(1); }
  }
  for (const [cid, pw] of Object.entries(pws)) {
    await c.query(`ALTER ROLE zc_${cid} PASSWORD '${pw}'`);
  }
  console.log("6 council role passwords set");

  const areas = {
    ogua: ["Ogua", "Ogua Mile 50", "Jumapo"], nkukwao: ["Nkukwao", "Nkukwao Market", "Suhyen"],
    betom: ["Betom", "Betom Market", "Effiduase"], srodae: ["Srodae", "Srodae Adweso", "Oyirim"],
    oldestate: ["Old Estate", "Old Estate Town", "Kukurantumi Road"], anlotown: ["Anlo-Town", "Anloga", "Esuose"],
  };
  for (const [cid, list] of Object.entries(areas)) {
    for (const a of list) {
      await c.query("INSERT INTO serial_counter (council_id, electoral_area, last_number) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING", [cid, a]);
    }
  }
  const total = await c.query("SELECT COUNT(*)::int AS n FROM serial_counter");
  console.log("serial_counter rows total:", total.rows[0].n);
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });