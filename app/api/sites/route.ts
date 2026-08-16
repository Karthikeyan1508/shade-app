import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { dataSourceLabel } from "@/lib/fortyguard";

export async function GET() {
  const db = getDb();
  const sites = db
    .prepare(
      `SELECT s.*,
              (SELECT tier FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_tier,
              (SELECT value FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_value,
              (SELECT ts FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_ts
       FROM sites s`
    )
    .all();

  return NextResponse.json({ sites, dataSource: dataSourceLabel() });
}
