import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callerAssetFormSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ callerId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { callerId } = await params;
    await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, select: { id: true } });
    const input = callerAssetFormSchema.parse(await request.json());
    const asset = await prisma.callerAsset.create({ data: {
      callerId,
      type: "SUPPORTING_VISUAL",
      label: input.label,
      url: input.url,
      creditText: input.creditText,
      creditUrl: input.creditUrl,
      manualHotkey: input.manualHotkey,
    } });
    return NextResponse.json({ assetId: asset.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add the visual." }, { status: 400 });
  }
}
