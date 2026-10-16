import { NextResponse } from "next/server";
import { getMarkets } from "@/lib/market-data/provider";
import { DEMO_ASSETS } from "@/lib/market-data/schema";
import { authRequiredResponse, isAuthenticated } from "@/lib/server/session";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  const demo = new URL(request.url).searchParams.get("mode") === "demo";
  if (demo) return NextResponse.json({ assets: DEMO_ASSETS, source: "DEMO FIXTURES · synthetic sample", updatedAt: new Date().toISOString(), mode: "demo" }, { headers: { "Cache-Control": "no-store" } });
  try { return NextResponse.json({ ...(await getMarkets()), mode: "live" }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
