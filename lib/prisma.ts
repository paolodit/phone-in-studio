import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/postgres";
const databaseSchema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const requestedPoolMax = Number(process.env.DATABASE_POOL_MAX || 10);
const poolMax = Number.isInteger(requestedPoolMax) && requestedPoolMax >= 1 && requestedPoolMax <= 50 ? requestedPoolMax : 10;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max: poolMax }, { schema: databaseSchema }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
