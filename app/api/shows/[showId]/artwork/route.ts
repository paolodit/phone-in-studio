import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limitedRequestBody, MAX_ARTWORK_BYTES, storeArtwork } from "@/lib/show-artwork-store";
import { saveShowIdentity } from "@/lib/show-identity-service";

export const runtime = "nodejs";
async function allowed(request: Request, showId: string) {
  if (!await isAdminSession()) return Response.json({ error: "Sign in to edit channel artwork." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await prisma.show.findUnique({ where: { id: showId }, select: { id: true } })) return Response.json({ error: "Channel not found." }, { status: 404 });
}
export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params; const denied = await allowed(request, showId); if (denied) return denied;
  if (!["image/png", "image/jpeg", "image/webp"].includes(request.headers.get("content-type") ?? "")) return Response.json({ error: "Choose a PNG, JPEG or WebP image." }, { status: 415 });
  try {
    const artworkUrl = await storeArtwork(await limitedRequestBody(request, MAX_ARTWORK_BYTES));
    return Response.json({ artworkUrl });
  } catch { return Response.json({ error: "Could not read that image. Use a still PNG, JPEG or WebP under 5 MB and 20 megapixels." }, { status: 400 }); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params; const denied = await allowed(request, showId); if (denied) return denied;
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415 });
  try {
    const identity = await saveShowIdentity(showId, JSON.parse((await limitedRequestBody(request, 4096)).toString("utf8")));
    revalidatePath("/", "layout");
    return Response.json({ identity });
  } catch { return Response.json({ error: "Could not save artwork. Check the fields or upload the image again, then retry." }, { status: 400 }); }
}
