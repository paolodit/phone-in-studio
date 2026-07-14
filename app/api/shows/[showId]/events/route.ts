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
  const close = () => { unsubscribe(); unsubscribeAudio(); if (heartbeat) clearInterval(heartbeat); };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (snapshot: typeof initial) => controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify(snapshot)}\n\n`));
      const sendAudio = (levels: { bands: number[]; level: number }) => controller.enqueue(encoder.encode(`event: audio-level\ndata: ${JSON.stringify(levels)}\n\n`));
      send(initial);
      unsubscribe = subscribeToShow(showId, send);
      unsubscribeAudio = subscribeToShowAudioLevels(showId, sendAudio);
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keepalive\n\n")), 15_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel: close,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
