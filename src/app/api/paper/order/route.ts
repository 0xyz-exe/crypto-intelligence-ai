import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaperService } from "@/lib/server/database";
import { LOCAL_PAPER_OWNER_ID } from "@/lib/server/paper-service";
import { authRequiredResponse, hasSameOrigin, isAuthenticated, readSmallJson, rejectCrossOriginResponse } from "@/lib/server/session";

const OrderBody = z.object({
  orderId: z.string().min(12).max(64).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(["buy", "close"]),
  assetId: z.string().min(1).max(32),
  requestedNotional: z.number().finite().positive().max(1_000_000).optional(),
}).strict().refine((value) => value.action !== "buy" || value.requestedNotional !== undefined);

export async function POST(request: Request) {
  if (!isAuthenticated(request)) return authRequiredResponse();
  if (!hasSameOrigin(request)) return rejectCrossOriginResponse();
  const parsed = OrderBody.safeParse(await readSmallJson(request, 2_048));
  if (!parsed.success) return NextResponse.json({ error: "Invalid paper order request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await getPaperService().placeOrder(LOCAL_PAPER_OWNER_ID, parsed.data);
    return NextResponse.json(result, { status: result.halted ? 423 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Paper order could not be processed; no exchange order was sent." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
