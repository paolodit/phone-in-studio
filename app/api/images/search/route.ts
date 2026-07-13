import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { searchStockImages } from "@/lib/stock-images";

export const runtime = "nodejs";

const querySchema = z.object({
  query: z.string().trim().min(2).max(100),
  provider: z.enum(["auto", "pexels", "pixabay"]).default("auto"),
});

export async function GET(request: Request) {
  await requireAdmin();
  try {
    const url = new URL(request.url);
    const input = querySchema.parse({ query: url.searchParams.get("query"), provider: url.searchParams.get("provider") ?? "auto" });
    return NextResponse.json(await searchStockImages(input.query, input.provider));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search stock images." }, { status: 400 });
  }
}
