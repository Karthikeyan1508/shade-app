/**
 * Pipeline — the glue: FortyGuard/Open-Meteo -> Risk Engine -> Agent ->
 * Dispatcher -> DB. This is what the "Refresh" button and the scheduled
 * poll both call, one site at a time.
 */

import getDb from "./db";
import { getCurrentConditions } from "./fortyguard";
import { classifyRisk, RiskTier } from "./risk-engine";
import { getRecommendation, ShiftInfo } from "./agent";
import { dispatch } from "./dispatcher";

export interface SiteRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  surface_type: string;
  jurisdiction: string;
}

const ACTIONABLE_TIERS: RiskTier[] = ["Warning", "Danger", "Extreme"];

export async function refreshSite(site: SiteRow) {
  const db = await getDb();
  const sunExposed = site.surface_type !== "shaded";

  const conditions = await getCurrentConditions(site.lat, site.lng, { sunExposed });
  const risk = classifyRisk(
    { tempC: conditions.tempC, rhPct: conditions.rhPct, windKph: conditions.windKph, sunExposed },
    site.jurisdiction
  );

  const ts = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO readings (site_id, ts, temp_c, rh_pct, wind_kph, solar_wm2, source, is_forecast)
     VALUES (?,?,?,?,?,?,?,0)`,
    args: [site.id, ts, conditions.tempC, conditions.rhPct, conditions.windKph ?? null, conditions.solarWm2 ?? null, conditions.source]
  });

  await db.execute({
    sql: `INSERT INTO risk_snapshots (site_id, ts, metric, value, tier) VALUES (?,?,?,?,?)`,
    args: [site.id, ts, risk.metric, risk.value, risk.tier]
  });

  let recommendationId: number | null = null;
  if (ACTIONABLE_TIERS.includes(risk.tier)) {
    const { rows: shiftsRows } = await db.execute({
      sql: `SELECT c.id as crewId, c.name as crewName, s.task, s.location_type as locationType,
                s.start_time as startTime, s.end_time as endTime
         FROM shifts s JOIN crews c ON c.id = s.crew_id WHERE c.site_id = ?`,
      args: [site.id]
    });
    const shifts = shiftsRows as unknown as ShiftInfo[];

    const rec = await getRecommendation(site.name, risk, shifts);

    const insert = await db.execute({
      sql: `INSERT INTO recommendations (site_id, crew_id, ts, tier, action_text, reason, status)
         VALUES (?,?,?,?,?,?, 'pending')`,
      args: [site.id, rec.crewId, ts, risk.tier, rec.actionText, rec.reason]
    });
    recommendationId = Number(insert.lastInsertRowid);

    await dispatch({
      recommendationId,
      siteId: site.id,
      siteName: site.name,
      tier: risk.tier,
      actionText: rec.actionText,
      reason: rec.reason,
    });
  }

  return { conditions, risk, recommendationId };
}

export async function refreshAllSites() {
  const db = await getDb();
  const { rows } = await db.execute(`SELECT * FROM sites`);
  const sites = rows as unknown as SiteRow[];
  const results = [];
  for (const site of sites) {
    try {
      results.push({ site: site.id, ...(await refreshSite(site)) });
    } catch (err) {
      console.error(`[pipeline] refresh failed for ${site.id}:`, err);
      results.push({ site: site.id, error: String(err) });
    }
  }
  return results;
}

