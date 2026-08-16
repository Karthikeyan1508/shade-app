import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { logApproval } from "@/lib/dispatcher";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const { rows } = await db.execute({
    sql: `SELECT * FROM recommendations WHERE id = ?`,
    args: [id]
  });
  const rec = rows[0] as unknown as
    | { id: number; site_id: string }
    | undefined;
  if (!rec) return NextResponse.json({ error: "recommendation not found" }, { status: 404 });

  await logApproval(Number(rec.id), rec.site_id);
  return NextResponse.json({ ok: true });
}
