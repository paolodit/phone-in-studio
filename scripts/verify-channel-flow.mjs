// Separate throwaway schema: never seed, reset or mutate the user's channels.
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Channel verification must use a local PostgreSQL server.");
const name = `phone_in_channel_test_${randomBytes(8).toString("hex")}`;
const admin = new pg.Client({ connectionString: base.toString() });
const run = (args, url) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, DATABASE_URL: url, PGSSLMODE: "disable" }, stdio: "inherit" });
  child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Verification command exited ${code}.`)));
});
let created = false;
let previousSearchPath;
try {
  await admin.connect();
  previousSearchPath = (await admin.query("SHOW search_path")).rows[0].search_path;
  // Prisma's embedded local runtime does not isolate named databases. A named
  // schema is respected by both migrate and the pg adapter, including locally.
  await admin.query(`CREATE SCHEMA "${name}"`); created = true;
  base.searchParams.set("schema", name);
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], base.toString());
  await run(["node_modules/tsx/dist/cli.mjs", "scripts/verify-channel-flow.ts"], base.toString());
} finally {
  if (created && /^phone_in_channel_test_[a-f0-9]{16}$/.test(name)) await admin.query(`DROP SCHEMA "${name}" CASCADE`);
  // The embedded runtime shares session settings across connections. Restore
  // the previous path so command-line clients don't target a removed test schema.
  if (previousSearchPath) await admin.query("SELECT set_config('search_path', $1, false)", [/^phone_in_channel_test_[a-f0-9]{16}$/.test(previousSearchPath) ? "public" : previousSearchPath]);
  await admin.end();
}
