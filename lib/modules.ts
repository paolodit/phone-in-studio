import type { OptionalModuleKey } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const OPTIONAL_MODULES = {
  AI_HOST: {
    name: "AI Host",
    description: "Give a show a configurable AI presenter while keeping a one-click human takeover.",
  },
  CALLER_FACTORY: {
    name: "Research & Caller Factory",
    description: "Develop a staged pack of 10–20 fictional caller candidates from one editorial brief.",
  },
} satisfies Record<OptionalModuleKey, { name: string; description: string }>;

export async function moduleEnabled(key: OptionalModuleKey) {
  return Boolean((await prisma.optionalModuleSetting.findUnique({ where: { key } }))?.enabled);
}

export async function globalModuleState() {
  const rows = await prisma.optionalModuleSetting.findMany();
  return Object.fromEntries((Object.keys(OPTIONAL_MODULES) as OptionalModuleKey[]).map((key) => [key, Boolean(rows.find((row) => row.key === key)?.enabled)])) as Record<OptionalModuleKey, boolean>;
}

export async function showModuleEnabled(showId: string, key: OptionalModuleKey) {
  if (!(await moduleEnabled(key))) return false;
  return Boolean((await prisma.showModuleSetting.findUnique({ where: { showId_key: { showId, key } } }))?.enabled);
}
