// A studio runs one Node process. Admission and draining change synchronously,
// before any await, so a new request cannot slip between the idle check and stop.
export class IdleGuard {
  private active = 0;
  private lastActivity: number;
  private draining: string | null = null;
  private prepared = false;
  constructor(private readonly clock = Date.now) { this.lastActivity = clock(); }
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
    try {
      if (await hasDurableWork()) { this.draining = null; return false; }
      this.prepared = true;
      return true;
    } catch (error) {
      this.draining = null;
      throw error;
    }
  }
  cancel(token: string) {
    if (this.draining && this.draining !== token) return false;
    if (this.draining && !this.prepared) return false;
    this.draining = null;
    this.prepared = false;
    this.lastActivity = this.clock();
    return true;
  }
}
