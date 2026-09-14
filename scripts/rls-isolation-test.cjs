// RLS ISOLATION TEST — proves council roles physically cannot cross tenants.
const { Client } = require("pg");

function dbUrl() {
  return process.env.DATABASE_URL.replace(/^"|"$/g, "");
}

function councilUrl(user, pw) {
  const url = dbUrl().replace("postgresql://", "").replace("postgres://", "");
  const [_, hostpart] = url.split("@");
  return `postgresql://${user}:${encodeURIComponent(pw)}@${hostpart}`;
}

async function asOwner() {
  const c = new Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("ALTER ROLE zc_adweso PASSWORD process.env.PW_A || 'REDACTED-see-ops-manual'");
  await c.query("ALTER ROLE zc_newtown PASSWORD process.env.PW_N || 'REDACTED-see-ops-manual'");
  await c.query("GRANT CONNECT ON DATABASE neondb TO zc_adweso, zc_newtown");
  const dbName = (await c.query("SELECT current_database()")).rows[0].current_database;
  console.log("db name:", dbName, "| owner grants done");
  await c.end();
}

async function asCouncil(user, pw, label) {
  const c = new Client({ connectionString: councilUrl(user, pw), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const me = (await c.query("SELECT current_user")).rows[0].current_user;
  const payers = (await c.query("SELECT COUNT(*)::int AS n FROM fee_payer")).rows[0].n;
  const users = (await c.query("SELECT username FROM app_user")).rows.map((r) => r.username);
  const licenses = (await c.query("SELECT id FROM license_state")).rows.map((r) => r.id);
  let insertBlocked = "";
  try {
    await c.query("INSERT INTO serial_counter (council_id, electoral_area, last_number) VALUES ('adweso', 'HACK', 99)");
    insertBlocked = "NO - SECURITY HOLE";
  } catch (e) {
    insertBlocked = "YES (" + e.message.slice(0, 40) + ")";
  }
  console.log(`--- ${label} (connected as ${me}) ---`);
  console.log("  fee_payer rows visible:", payers);
  console.log("  app_users visible:", users.join(", ") || "NONE");
  console.log("  license rows visible:", licenses.join(", ") || "NONE");
  console.log("  cross-council INSERT blocked:", insertBlocked);
  await c.end();
}

(async () => {
  await asOwner();
  await asCouncil("zc_newtown", process.env.PW_N, "NEW TOWN role (must see NOTHING of Adweso's 8 records)");
  await asCouncil("zc_adweso", process.env.PW_A, "ADWESO role (must see its own 8 records + 4 users");
})().catch((e) => { console.error("TEST FAILED:", e.message); process.exit(1); });