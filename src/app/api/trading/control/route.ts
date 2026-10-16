import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaperService } from "@/lib/server/database";
import { authRequiredResponse, hasSameOrigin, isAuthenticated, readSmallJson, rejectCrossOriginResponse } from "@/lib/server/session";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  try {
    return NextResponse.json({ ...getPaperService().getControl(), liveExecutionEnabled: false, testnetExecutionEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Trading control state is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const parsed = z.object({ halted: z.boolean() }).strict().safeParse(await readSmallJson(request, 256));
  if (!parsed.success) return NextResponse.json({ error: "Invalid trading control request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const control = getPaperService().setHalted(parsed.data.halted);
    return NextResponse.json({ ...control, liveExecutionEnabled: false, testnetExecutionEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Trading control state could not be updated." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
