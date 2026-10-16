import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaperService } from "@/lib/server/database";
import { LOCAL_PAPER_OWNER_ID } from "@/lib/server/paper-service";
import { authRequiredResponse, hasSameOrigin, isAuthenticated, readSmallJson, rejectCrossOriginResponse } from "@/lib/server/session";

export async function POST(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const body = z.object({}).strict().safeParse(await readSmallJson(request, 256));
  if (!body.success) return NextResponse.json({ error: "Invalid paper mark request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const account = await getPaperService().markToMarket(LOCAL_PAPER_OWNER_ID);
    return NextResponse.json({ account }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fresh market data is unavailable; paper equity was not marked." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
