import { NextResponse } from "next/server";
import { getPaperService } from "@/lib/server/database";
import { LOCAL_PAPER_OWNER_ID } from "@/lib/server/paper-service";
import { authRequiredResponse, isAuthenticated } from "@/lib/server/session";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  try {
    const service = getPaperService();
    const account = service.getOrCreateAccount(LOCAL_PAPER_OWNER_ID);
    return NextResponse.json({ account, control: service.getControl(), liveExecutionEnabled: false, testnetExecutionEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Paper account is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
