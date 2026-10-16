import { NextResponse } from "next/server";
import { z } from "zod";
import { ASSETS } from "@/lib/market-data/schema";
import { AnalysisSchema, deterministicAnalysis, optionalAI } from "@/lib/ai/analysis";
import { authRequiredResponse, hasSameOrigin, isAuthenticated, readSmallJson, rejectCrossOriginResponse } from "@/lib/server/session";

const Input = z.object({ assetId: z.string().max(40), price: z.number().finite().positive(), change24h: z.number().finite().min(-100).max(10000), timestamp: z.string().datetime(), rsi: z.number().finite().min(0).max(100).nullable(), sma20: z.number().finite().positive().nullable(), atr: z.number().finite().positive().nullable() });
const buckets = new Map<string, { count: number; start: number }>();
export async function POST(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const ip = "local";
  const now = Date.now(), bucket = buckets.get(ip);
  if (buckets.size > 10000) for (const [key, value] of buckets) if (now - value.start > 60_000) buckets.delete(key);
  if (buckets.size >= 10000 && !bucket) return NextResponse.json({ error: "Analysis service is busy. Try again shortly." }, { status: 429 });
  if (!bucket || now - bucket.start > 60_000) buckets.set(ip, { count: 1, start: now });
  else if (++bucket.count > 10) return NextResponse.json({ error: "Analysis request limit reached. Try again in a minute." }, { status: 429 });
  try {
    const raw = await readSmallJson(request, 4096);
    if (raw === null) return NextResponse.json({ error: "Invalid or oversized analysis request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const input = Input.parse(raw), asset = ASSETS.find((item) => item.id === input.assetId);
    if (!asset) return NextResponse.json({ error: "Unsupported asset." }, { status: 400 });
    const base = deterministicAnalysis({ ...asset, price: input.price, change24h: input.change24h }, input.timestamp, { rsi: input.rsi, sma20: input.sma20, atr: input.atr });
    const model = await optionalAI(base).catch(() => null);
    const result = AnalysisSchema.parse(model ?? base);
    return NextResponse.json({ analysis: result, mode: model ? "optional-free-ai" : "deterministic" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError || error instanceof SyntaxError ? "Invalid analysis request." : "Analysis is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503 });
  }
}
