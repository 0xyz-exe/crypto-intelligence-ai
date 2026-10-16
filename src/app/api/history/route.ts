import { NextResponse } from "next/server";
import { getHistory } from "@/lib/market-data/provider";
import { demoCandles, DEMO_ASSETS } from "@/lib/market-data/schema";
import { authRequiredResponse, isAuthenticated } from "@/lib/server/session";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  const params = new URL(request.url).searchParams;
  const assetId = params.get("asset") ?? "bitcoin", interval = params.get("interval") ?? "1h";
  const asset = DEMO_ASSETS.find((x) => x.id === assetId);
  if (!asset) return NextResponse.json({ error: "Unsupported asset." }, { status: 400 });
  if (params.get("mode") === "demo") return NextResponse.json({ candles: demoCandles(asset, 120, interval === "1d" ? 86_400_000 : interval === "4h" ? 14_400_000 : 3_600_000), source: "DEMO FIXTURES · synthetic sample", updatedAt: new Date().toISOString(), mode: "demo" }, { headers: { "Cache-Control": "no-store" } });
  try { return NextResponse.json({ ...(await getHistory(assetId, interval)), mode: "live" }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Historical market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
