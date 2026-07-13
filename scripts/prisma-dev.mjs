import { loadConfigFromFile } from "@prisma/config";
import { run } from "@prisma/cli-dev";

const { config, error } = await loadConfigFromFile({});
if (error || !config) throw new Error(`Unable to load Prisma configuration: ${String(error)}`);
await run(process.argv.slice(2), config);
