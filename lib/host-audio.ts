/** Resolve only when the whole line was heard. Abort stops playback and releases
 * the object URL, including when Stop is pressed during audio preparation. */
export async function playHostAudio(blob: Blob, signal: AbortSignal, onAudio?: (audio: HTMLAudioElement) => void) {
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  onAudio?.(audio);
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { signal.removeEventListener("abort", abort); audio.onended = null; audio.onerror = null; };
      const abort = () => { audio.pause(); cleanup(); reject(new DOMException("Host stopped", "AbortError")); };
      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); reject(new Error("The browser could not play the AI Host voice. Check your audio output and try again.")); };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      void audio.play().catch(() => { cleanup(); reject(new Error("Host audio was blocked. Click the host control again to allow playback.")); });
    });
  } finally { audio.pause(); URL.revokeObjectURL(url); }
}
