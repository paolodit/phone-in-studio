import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { hangupOpenAILiveSession, readLiveCloseToken } from "@/lib/openai-live-close";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null);
  const id = typeof input?.closeToken === "string" && input.closeToken.length < 1500 ? readLiveCloseToken(input.closeToken) : null;
  if (!id) return NextResponse.json({ error: "Invalid or expired session close token." }, { status: 400 });
  try {
    if (await hangupOpenAILiveSession(id)) return NextResponse.json({ closed: true });
  } catch { /* Do not expose provider response bodies or credentials. */ }
  return NextResponse.json({ error: "GPT-Live shutdown could not be confirmed." }, { status: 502 });
}
