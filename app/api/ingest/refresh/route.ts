import { NextResponse } from "next/server";
import { refreshAllSites } from "@/lib/pipeline";

export async function POST() {
  const results = await refreshAllSites();
  return NextResponse.json({ results });
}
