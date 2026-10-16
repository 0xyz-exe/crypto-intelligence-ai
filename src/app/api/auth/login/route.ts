import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthStore } from "@/lib/server/database";
import { hasSameOrigin, readSmallJson, rejectCrossOriginResponse, setSessionCookie } from "@/lib/server/session";

const LoginInput = z.object({ password: z.string().max(512) }).strict();

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const parsed = LoginInput.safeParse(await readSmallJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const auth = getAuthStore();
  const now = Date.now();
  const token = await auth.login(parsed.data.password, now);
  if (!token) {
    const locked = auth.isLoginLocked(Date.now());
    return NextResponse.json(
      { error: locked ? "Sign-in is temporarily paused after repeated failures. Try again in 15 minutes." : "Password not accepted." },
      { status: locked ? 429 : 401, headers: { "Cache-Control": "no-store", ...(locked ? { "Retry-After": "900" } : {}) } },
    );
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  setSessionCookie(response, token, request);
  return response;
}
