// A studio runs one Node process. Admission and draining change synchronously,
// before any await, so a new request cannot slip between the idle check and stop.
export type IdleState = {
  load(): string | null;
  save(token: string): void;
  clear(): void;
};
export class IdleGuard {
  private active = 0;
  private lastActivity: number;
  private draining: string | null = null;
  private prepared = false;
  private checking = false;
  constructor(private readonly clock = Date.now, private readonly state?: IdleState) {
    this.lastActivity = clock();
    this.draining = state?.load() ?? null;
    this.prepared = this.draining !== null;
  }
  enter(): (() => void) | null {
    if (this.draining) return null;
    this.active++;
    this.lastActivity = this.clock();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.lastActivity = this.clock();
    };
  }
  async prepare(token: string, idleMs: number, hasDurableWork: () => Promise<boolean>) {
    if (this.draining) return this.draining === token && this.prepared;
    if (this.active || this.clock() - this.lastActivity < idleMs) return false;
    this.draining = token;
    this.checking = true;
    try {
      if (await hasDurableWork()) { this.draining = null; return false; }
      // Persist before acknowledging. A process restart must not admit a new
      // show while the controller is about to stop the old prepared process.
      this.state?.save(token);
      this.prepared = true;
      return true;
    } finally {
      // Failed checks/writes keep admission closed until explicit cancellation;
      // in particular an ambiguous disk write must never reopen it.
      this.checking = false;
    }
  }
  cancel(token: string) {
    if (this.draining && this.draining !== token) return false;
    if (this.checking) return false;
    this.state?.clear();
    this.draining = null;
    this.prepared = false;
    this.lastActivity = this.clock();
    return true;
  }
}
