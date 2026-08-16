import { NextResponse } from "next/server";
import { refreshAllSites } from "@/lib/pipeline";

export const maxDuration = 30; // seconds — default 10s can be tight for a 4-site sequential refresh

export async function POST() {
  const results = await refreshAllSites();
  return NextResponse.json({ results });
}
