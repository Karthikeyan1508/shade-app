import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const db = getDb();

  const rows = status
    ? db
        .prepare(
          `SELECT r.*, s.name as site_name FROM recommendations r
           JOIN sites s ON s.id = r.site_id WHERE r.status = ? ORDER BY r.ts DESC`
        )
        .all(status)
    : db
        .prepare(
          `SELECT r.*, s.name as site_name FROM recommendations r
           JOIN sites s ON s.id = r.site_id ORDER BY r.ts DESC`
        )
        .all();

  return NextResponse.json({ recommendations: rows });
}
