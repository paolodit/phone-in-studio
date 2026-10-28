import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { IdleState } from "./idle-guard";

/** The hosted persistent data volume retains the stop barrier across restarts. */
export function fileIdleState(file: string): IdleState {
  return {
    load() {
      let raw: string;
      try { raw = readFileSync(file, "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      const value = JSON.parse(raw);
      if (value.protocol !== 1 || !/^[a-f0-9-]{36}$/.test(value.token || ""))
        throw new Error("Invalid saved studio sleep barrier; operator review required.");
      return value.token;
    },
    save(token) {
      mkdirSync(path.dirname(file), { recursive: true });
      const temporary = file + ".tmp";
      writeFileSync(temporary, JSON.stringify({ protocol: 1, token }), { mode: 0o600 });
      renameSync(temporary, file);
    },
    clear() { rmSync(file, { force: true }); },
  };
}
