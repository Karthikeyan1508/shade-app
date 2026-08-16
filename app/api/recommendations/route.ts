import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const db = await getDb();

  const { rows } = status
    ? await db.execute({
        sql: `SELECT r.*, s.name as site_name FROM recommendations r
            JOIN sites s ON s.id = r.site_id WHERE r.status = ? ORDER BY r.ts DESC`,
        args: [status]
      })
    : await db.execute(
        `SELECT r.*, s.name as site_name FROM recommendations r
            JOIN sites s ON s.id = r.site_id ORDER BY r.ts DESC`
      );

  return NextResponse.json({ recommendations: rows });
}
