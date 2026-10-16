import { NextResponse } from "next/server";
import { getOrderBookSnapshot } from "@/lib/market-data/provider";
import { authRequiredResponse, isAuthenticated } from "@/lib/server/session";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  const assetId = new URL(request.url).searchParams.get("asset") ?? "bitcoin";
  try {
    return NextResponse.json(await getOrderBookSnapshot(assetId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const unsupported = error instanceof Error && error.message === "Unsupported asset.";
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order book snapshot is temporarily unavailable." }, { status: unsupported ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
