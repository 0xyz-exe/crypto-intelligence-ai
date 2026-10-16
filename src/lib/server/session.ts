import { NextResponse } from "next/server";
import { getAuthStore } from "./database";
import { SESSION_TTL_MS, type LocalAuthStore } from "./auth";

export const SESSION_COOKIE_NAME = "cia_session";

export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const token = part.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
  }
  return null;
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    const requestProtocol = new URL(request.url).protocol;
    const hostUrl = new URL(`${requestProtocol}//${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname.toLowerCase())) return false;
    return new URL(origin).origin === hostUrl.origin;
  } catch { return false; }
}

export function isAuthenticated(request: Request, auth: LocalAuthStore = getAuthStore(), now = Date.now()): boolean {
  const token = getSessionToken(request);
  return token !== null && auth.verify(token, now);
}

export function setSessionCookie(response: NextResponse, token: string, request: Request): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse, request: Request): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function authRequiredResponse(): NextResponse {
  return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function rejectCrossOriginResponse(): NextResponse {
  return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

export async function readSmallJson(request: Request, maxBytes = 2_048): Promise<unknown | null> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return null;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
