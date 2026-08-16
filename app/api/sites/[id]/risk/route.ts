import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getForecast } from "@/lib/fortyguard";
import { classifyRisk } from "@/lib/risk-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(id) as
    | { id: string; lat: number; lng: number; surface_type: string; jurisdiction: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "site not found" }, { status: 404 });

  const history = db
    .prepare(`SELECT * FROM risk_snapshots WHERE site_id = ? ORDER BY ts DESC LIMIT 24`)
    .all(id);

  const sunExposed = site.surface_type !== "shaded";
  const forecast = await getForecast(site.lat, site.lng, 24, { sunExposed });
  const forecastRisk = forecast.map((c) => ({
    ts: c.ts,
    ...classifyRisk({ tempC: c.tempC, rhPct: c.rhPct, windKph: c.windKph, sunExposed }, site.jurisdiction, new Date(c.ts)),
  }));

  return NextResponse.json({ site, history, forecast: forecastRisk });
}
