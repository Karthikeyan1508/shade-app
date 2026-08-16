import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import seedData from "@/data/sites.seed.json";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "shade.sqlite");

// Ensure the data directory exists (SQLite won't create it for you).
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __shadeDb: Database.Database | undefined;
}

function createSchema(db: Database.Database) {
  db.exec(`
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
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM sites").get() as { n: number }).n;
  if (count > 0) return;

  const insertSite = db.prepare(
    `INSERT INTO sites (id, name, lat, lng, surface_type, jurisdiction) VALUES (?,?,?,?,?,?)`
  );
  const insertCrew = db.prepare(
    `INSERT INTO crews (id, site_id, name, workload_category, acclimatized) VALUES (?,?,?,?,?)`
  );
  const insertShift = db.prepare(
    `INSERT INTO shifts (crew_id, task, location_type, start_time, end_time) VALUES (?,?,?,?,?)`
  );

  const insertAll = db.transaction(() => {
    for (const site of seedData.sites) {
      insertSite.run(site.id, site.name, site.lat, site.lng, site.surface_type, site.jurisdiction);
      for (const crew of site.crews) {
        insertCrew.run(crew.id, site.id, crew.name, crew.workload_category, crew.acclimatized ? 1 : 0);
        for (const shift of crew.shifts) {
          insertShift.run(crew.id, shift.task, shift.location_type, shift.start, shift.end);
        }
      }
    }
  });
  insertAll();
}

function getDb(): Database.Database {
  if (!global.__shadeDb) {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    createSchema(db);
    seedIfEmpty(db);
    global.__shadeDb = db;
  }
  return global.__shadeDb;
}

export default getDb;
