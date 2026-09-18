/** A cancelled timer has not consumed the caller's turn. Keep the latest
 * callback without restarting the wait on unrelated Studio/SSE refreshes. */
export class HostTurnScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingKey = "";
  private handledKey = "";
  private run: (() => void) | undefined;

  schedule(key: string, run: () => void, delay = 900) {
    if (key === this.handledKey) return;
    this.run = run;
    if (this.pendingKey === key && this.timer) return;
    this.cancel();
    this.pendingKey = key;
    this.run = run;
    this.timer = setTimeout(() => {
      const callback = this.run;
      this.handledKey = key;
      this.timer = undefined;
      this.pendingKey = "";
      callback?.();
    }, delay);
  }

  cancel() { clearTimeout(this.timer); this.timer = undefined; this.pendingKey = ""; this.run = undefined; }
  reset() { this.cancel(); this.handledKey = ""; }
}
