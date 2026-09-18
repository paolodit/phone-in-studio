export type LiveTranscriptFragment = { speaker: "HOST" | "CALLER"; delta: string; start_ms?: number; end_ms?: number };

// UI batching only: these groups are NOT semantic turns, voice activity, or
// permission to interrupt. Input and output can accumulate simultaneously.
export class LiveTranscriptBuffer {
  private pending: Record<"HOST" | "CALLER", string> = { HOST: "", CALLER: "" };
  private timers: Partial<Record<"HOST" | "CALLER", ReturnType<typeof setTimeout>>> = {};
  constructor(private emit: (entry: { speaker: "HOST" | "CALLER"; text: string }) => void) {}
  push(fragment: LiveTranscriptFragment) {
    const speaker = fragment.speaker;
    this.pending[speaker] += fragment.delta;
    clearTimeout(this.timers[speaker]);
    if (this.pending[speaker].length >= 2800) this.flush(speaker);
    else this.timers[speaker] = setTimeout(() => this.flush(speaker), 900);
  }
  flush(speaker?: "HOST" | "CALLER") {
    for (const who of speaker ? [speaker] : ["HOST", "CALLER"] as const) {
      clearTimeout(this.timers[who]);
      const text = this.pending[who]; this.pending[who] = "";
      if (text.trim()) this.emit({ speaker: who, text });
    }
  }
}

export async function waitForIceGathering(peer: RTCPeerConnection, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); peer.removeEventListener("icegatheringstatechange", changed); signal?.removeEventListener("abort", aborted); };
    const changed = () => { if (peer.iceGatheringState === "complete") { cleanup(); resolve(); } };
    const aborted = () => { cleanup(); reject(new DOMException("Connection cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("GPT-Live could not gather an audio connection. Check the network and try again.")); }, 10_000);
    peer.addEventListener("icegatheringstatechange", changed);
    signal?.addEventListener("abort", aborted, { once: true });
    changed();
  });
}
