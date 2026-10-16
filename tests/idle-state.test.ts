import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IdleGuard } from "@/lib/idle-guard";
import { fileIdleState } from "@/lib/idle-state";

const directories: string[]=[];
function storage() {
  const directory=mkdtempSync(path.join(os.tmpdir(),"studio-idle-")); directories.push(directory);
  const file=path.join(directory,"hosted-sleep.json");
  return {file,state:fileIdleState(file)};
}
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
describe("Persistent hosted stop barrier",()=>{
  it("refuses new work after a prepared process restarts, until matching cancellation",async()=>{
    const {state,file}=storage();let now=0;
    const first=new IdleGuard(()=>now,state);now=1000;
    const token="12345678-1234-1234-1234-123456789abc";
    expect(await first.prepare(token,1000,async()=>false)).toBe(true);
    expect(JSON.parse(readFileSync(file,"utf8")).token).toBe(token);
    const restarted=new IdleGuard(()=>now,state);
    expect(restarted.enter()).toBeNull();
    expect(await restarted.prepare(token,1000,async()=>false)).toBe(true);
    expect(restarted.cancel("wrong")).toBe(false);
    expect(restarted.cancel(token)).toBe(true);
    expect(state.load()).toBeNull();
    expect(new IdleGuard(()=>now,state).enter()).not.toBeNull();
  });
  it("refuses to silently discard corrupt saved state",()=>{
    const {state,file}=storage();writeFileSync(file,'{"protocol":1,"token":"bad"}');
    expect(()=>new IdleGuard(Date.now,state)).toThrow("Invalid saved studio sleep barrier");
  });
});
