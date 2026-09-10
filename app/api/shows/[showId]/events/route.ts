import { canViewBroadcast, getBroadcastSnapshot } from "@/lib/show-service";
import { isAdminSession } from "@/lib/auth";
import { subscribeToShow, subscribeToShowAudioLevels } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  if (!(await isAdminSession()) && !(await canViewBroadcast(showId, token))) return new Response("Unauthorized", { status: 401 });
  const initial = await getBroadcastSnapshot(showId);
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let unsubscribeAudio = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe(); unsubscribeAudio();
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
      heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15_000);
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close();
    },
    cancel: close,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
