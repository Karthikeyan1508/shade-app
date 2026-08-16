import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { logApproval } from "@/lib/dispatcher";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const rec = db.prepare(`SELECT * FROM recommendations WHERE id = ?`).get(id) as
    | { id: number; site_id: string }
    | undefined;
  if (!rec) return NextResponse.json({ error: "recommendation not found" }, { status: 404 });

  await logApproval(rec.id, rec.site_id);
  return NextResponse.json({ ok: true });
}
