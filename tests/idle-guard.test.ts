import { describe, it, expect } from "vitest";
import { IdleGuard, type IdleState } from "@/lib/idle-guard";
describe("Hosted studio stop admission", () => {
  it("protects requests for their full duration, including slow saves and streams", async () => {
    let now=0; const guard=new IdleGuard(()=>now); const release=guard.enter()!;
    now=100000; expect(await guard.prepare("stop",1000,async()=>false)).toBe(false);
    release(); release(); now+=999; expect(await guard.prepare("stop",1000,async()=>false)).toBe(false);
    now++; expect(await guard.prepare("stop",1000,async()=>false)).toBe(true);
  });
  it("blocks a show start arriving while the final database check is pending", async () => {
    let now=0; const guard=new IdleGuard(()=>now); now=1000;
    let finish!: (busy:boolean)=>void;
    const stopping=guard.prepare("stop",1000,()=>new Promise(resolve=>{finish=resolve;}));
    expect(guard.enter()).toBeNull();
    expect(await guard.prepare("stop",1000,async()=>false)).toBe(false);
    expect(guard.cancel("stop")).toBe(false);
    finish(false); expect(await stopping).toBe(true);
    expect(guard.enter()).toBeNull(); expect(guard.cancel("wrong")).toBe(false);
    expect(guard.cancel("stop")).toBe(true); expect(guard.enter()).not.toBeNull();
  });
  it("never expires a live show and requires cancellation after a failed safety check", async () => {
    let now=0; const guard=new IdleGuard(()=>now); now=1e10;
    expect(await guard.prepare("stop",1000,async()=>true)).toBe(false);
    const release=guard.enter()!; release(); now+=1000;
    await expect(guard.prepare("stop",1000,async()=>{throw new Error("database unavailable");})).rejects.toThrow();
    expect(guard.enter()).toBeNull();
    expect(guard.cancel("stop")).toBe(true);
    expect(guard.enter()).not.toBeNull();
  });
  it("retries the same prepared stop without reopening admission", async () => {
    let now=0; const guard=new IdleGuard(()=>now); now=1000;
    expect(await guard.prepare("one",1000,async()=>false)).toBe(true);
    expect(await guard.prepare("one",1000,async()=>true)).toBe(true);
    expect(await guard.prepare("two",1000,async()=>false)).toBe(false);
    expect(guard.enter()).toBeNull();
  });
  it("retains the barrier if its disk write or cancellation fails", async () => {
    let now=0;
    const state:IdleState={load:()=>null,save:()=>{throw new Error("disk unavailable");},clear:()=>{throw new Error("disk unavailable");}};
    const guard=new IdleGuard(()=>now,state); now=1000;
    await expect(guard.prepare("stop",1000,async()=>false)).rejects.toThrow();
    expect(guard.enter()).toBeNull();
    expect(await guard.prepare("stop",1000,async()=>false)).toBe(false);
    expect(()=>guard.cancel("stop")).toThrow();
    expect(guard.enter()).toBeNull();
    state.clear=()=>{};
    expect(guard.cancel("stop")).toBe(true);
    expect(guard.enter()).not.toBeNull();
  });
});
