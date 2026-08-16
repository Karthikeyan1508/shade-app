import { createClient, InStatement } from "@libsql/client";
import seedData from "@/data/sites.seed.json";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://placeholder-shade-db.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "placeholder",
});

let initialized: Promise<void> | null = null;

async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      surface_type TEXT NOT NULL,
      jurisdiction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      name TEXT NOT NULL,
      workload_category TEXT NOT NULL,
      acclimatized INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_id TEXT NOT NULL REFERENCES crews(id),
      task TEXT NOT NULL,
      location_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL REFERENCES sites(id),
      ts TEXT NOT NULL,
      temp_c REAL NOT NULL,
      rh_pct REAL NOT NULL,
      wind_kph REAL,
      solar_wm2 REAL,
      source TEXT NOT NULL,
      is_forecast INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS risk_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL REFERENCES sites(id),
      ts TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      tier TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL REFERENCES sites(id),
      crew_id TEXT,
      ts TEXT NOT NULL,
      tier TEXT NOT NULL,
      action_text TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_ts TEXT
    );

    CREATE TABLE IF NOT EXISTS compliance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recommendation_id INTEGER,
      site_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT
    );
  `);

  const { rows } = await db.execute("SELECT COUNT(*) as n FROM sites");
  if (Number(rows[0].n) > 0) return;

  const batchStatements: InStatement[] = [];
  for (const site of seedData.sites) {
    batchStatements.push({
      sql: `INSERT INTO sites (id, name, lat, lng, surface_type, jurisdiction) VALUES (?,?,?,?,?,?)`,
      args: [site.id, site.name, site.lat, site.lng, site.surface_type, site.jurisdiction],
    });
    for (const crew of site.crews) {
      batchStatements.push({
        sql: `INSERT INTO crews (id, site_id, name, workload_category, acclimatized) VALUES (?,?,?,?,?)`,
        args: [crew.id, site.id, crew.name, crew.workload_category, crew.acclimatized ? 1 : 0],
      });
      for (const shift of crew.shifts) {
        batchStatements.push({
          sql: `INSERT INTO shifts (crew_id, task, location_type, start_time, end_time) VALUES (?,?,?,?,?)`,
          args: [crew.id, shift.task, shift.location_type, shift.start, shift.end],
        });
      }
    }
  }

  if (batchStatements.length > 0) {
    await db.batch(batchStatements, "write");
  }
}

export async function getDb() {
  if (!initialized) {
    initialized = initDb();
  }
  await initialized;
  return db;
}

export default getDb;
