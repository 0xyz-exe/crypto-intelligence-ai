import { NextResponse } from "next/server";
import { getAuthStore } from "@/lib/server/database";
import { clearSessionCookie, getSessionToken, hasSameOrigin, rejectCrossOriginResponse } from "@/lib/server/session";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const token = getSessionToken(request);
  if (token) getAuthStore().logout(token);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(response, request);
  return response;
}
