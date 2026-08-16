import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { dataSourceLabel } from "@/lib/fortyguard";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const { rows: sites } = await db.execute(
    `SELECT s.*,
            (SELECT tier FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_tier,
            (SELECT value FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_value,
            (SELECT ts FROM risk_snapshots rs WHERE rs.site_id = s.id ORDER BY rs.ts DESC LIMIT 1) as latest_ts
     FROM sites s`
  );

  return NextResponse.json({ sites, dataSource: dataSourceLabel() });
}
