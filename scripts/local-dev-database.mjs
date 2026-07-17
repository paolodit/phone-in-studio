import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0";

if (mode !== "init" && mode !== "dev" && mode !== "verify" && mode !== "realtime") throw new Error("Usage: node scripts/local-dev-database.mjs <init|dev|verify|realtime>");

function waitFor(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Child process exited with ${signal ?? code ?? "an unknown status"}.`)));
  });
}

function startNode(args, stdio = "inherit") {
  return spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, PGSSLMODE: "disable" },
    stdio,
  });
}

async function ensureDatabase() {
  await waitFor(startNode([path.join(root, "scripts", "prisma-dev.mjs"), "--detach", "--name", "ai-phone-in"]));
}

await ensureDatabase();

if (mode === "init") {
  await waitFor(startNode([path.join(root, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"]));
  await waitFor(startNode([path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts"]));
} else if (mode === "verify") {
  await waitFor(startNode([path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/verify-local-flow.ts"]));
} else if (mode === "realtime") {
  await waitFor(startNode([path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/verify-realtime-session.ts"]));
} else {
  // Keep every local instance on the same explicit port. Next otherwise moves a
  // second dev server to 3001/3002 while all instances still write to `.next`,
  // which can corrupt the shared development bundle.
  const child = startNode([path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--port", "3000"]);
  const stop = () => child.kill("SIGINT");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await waitFor(child);
}
