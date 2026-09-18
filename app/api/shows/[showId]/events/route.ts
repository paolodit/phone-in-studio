import { canViewBroadcast, getBroadcastSnapshot } from "@/lib/show-service";
import { isAdminSession } from "@/lib/auth";
import { subscribeToShow, subscribeToShowAudioLevels, subscribeToShowDeleted } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A reconnect may have missed the in-process deletion event. No channel data is
// disclosed here; tell stale displays to clear instead of keeping an old caller.
const deletedStream = () => new Response("event: deleted\ndata: {}\n\n", { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  if (!(await prisma.show.findUnique({ where: { id: showId }, select: { id: true } }))) return deletedStream();
  if (!(await isAdminSession()) && !(await canViewBroadcast(showId, token))) return new Response("Unauthorized", { status: 401 });
  let initial;
  try { initial = await getBroadcastSnapshot(showId); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return deletedStream();
    throw error;
  }
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let unsubscribeAudio = () => {};
  let unsubscribeDeleted = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe(); unsubscribeAudio(); unsubscribeDeleted();
    if (heartbeat) clearInterval(heartbeat);
    request.signal.removeEventListener("abort", close);
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (data: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(data)); } catch { close(); }
      };
      const send = (snapshot: typeof initial) => enqueue(`event: state\ndata: ${JSON.stringify(snapshot)}\n\n`);
      const sendAudio = (levels: { bands: number[]; level: number }) => {
        // Audio frames are disposable. Do not buffer meters for a slow reader.
        if ((controller.desiredSize ?? 0) > 0) enqueue(`event: audio-level\ndata: ${JSON.stringify(levels)}\n\n`);
      };
      send(initial);
      unsubscribe = subscribeToShow(showId, send);
      unsubscribeAudio = subscribeToShowAudioLevels(showId, sendAudio);
      unsubscribeDeleted = subscribeToShowDeleted(showId, () => { enqueue("event: deleted\ndata: {}\n\n"); close(); try { controller.close(); } catch { /* Reader already closed. */ } });
      heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15_000);
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close();
    },
    cancel: close,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
