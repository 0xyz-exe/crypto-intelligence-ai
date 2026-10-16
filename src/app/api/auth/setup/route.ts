import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthStore } from "@/lib/server/database";
import { hasSameOrigin, readSmallJson, rejectCrossOriginResponse, setSessionCookie } from "@/lib/server/session";

const SetupInput = z.object({ password: z.string().max(512).refine((value) => [...value].length >= 12 && [...value].length <= 128) }).strict();

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const parsed = SetupInput.safeParse(await readSmallJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose a password between 12 and 128 characters." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const auth = getAuthStore();
  if (!auth.needsSetup()) return NextResponse.json({ error: "Local account setup is already complete." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  try {
    const token = await auth.setup(parsed.data.password, Date.now());
    if (!token) return NextResponse.json({ error: "Local account setup is already complete." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookie(response, token, request);
    return response;
  } catch {
    return NextResponse.json({ error: "Local account setup could not be completed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
