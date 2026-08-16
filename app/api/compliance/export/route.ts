import getDb from "@/lib/db";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cl.ts, s.name as site, cl.event_type, cl.payload_json
       FROM compliance_log cl JOIN sites s ON s.id = cl.site_id
       ORDER BY cl.ts DESC`
    )
    .all() as Record<string, unknown>[];

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="shade-compliance-log.csv"`,
    },
  });
}
