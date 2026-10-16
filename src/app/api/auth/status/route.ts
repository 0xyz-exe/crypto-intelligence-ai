import { NextResponse } from "next/server";
import { getAuthStore } from "@/lib/server/database";
import { isAuthenticated } from "@/lib/server/session";

export async function GET(request: Request) {
  const auth = getAuthStore();
  return NextResponse.json({ setupRequired: auth.needsSetup(), authenticated: isAuthenticated(request, auth) }, { headers: { "Cache-Control": "no-store" } });
}
