// Optional operator-managed Docker secret. Self-hosted environment settings still work normally.
const fs = require("node:fs");
if (process.env.RUNTIME_CONFIG_FILE) {
  const settings = JSON.parse(fs.readFileSync(process.env.RUNTIME_CONFIG_FILE, "utf8"));
  for (const [key, value] of Object.entries(settings)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== "string") throw new Error("Invalid runtime configuration");
    process.env[key] = value;
  }
}
