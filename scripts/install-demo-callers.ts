import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { callerStructuredData } from "../lib/caller";
import { demoCallerFixtures } from "../lib/demo-callers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to install the demo callers.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }) });

async function main() {
  let created = 0;
  let refreshed = 0;
  for (const fixture of demoCallerFixtures) {
    const structured = callerStructuredData(fixture);
    const existing = await prisma.caller.findFirst({ where: { generation: { path: ["fixtureId"], equals: fixture.fixtureId } }, select: { id: true } });
    const data = {
      firstName: fixture.firstName,
      surnameInitial: fixture.surnameInitial,
      age: fixture.age,
      location: fixture.location,
      occupation: fixture.occupation,
      relationshipStatus: fixture.relationshipStatus,
      issueHeadline: fixture.issueHeadline,
      openingSummary: fixture.openingSummary,
      status: "APPROVED" as const,
      approvedAt: new Date(),
      approvedBy: "demo pack",
      character: structured.character as Prisma.InputJsonValue,
      story: structured.story as Prisma.InputJsonValue,
      performance: structured.performance as Prisma.InputJsonValue,
      hostSupport: structured.hostSupport as Prisma.InputJsonValue,
      generation: { source: "DEMO_PACK", fixtureId: fixture.fixtureId, topicTags: fixture.topicTags.split(",").map((tag) => tag.trim()), callMode: fixture.callMode, emotionalTemperature: fixture.emotionalTemperature } as Prisma.InputJsonValue,
      quality: { overall: 100, manuallyApproved: true } as Prisma.InputJsonValue,
    };
    if (existing) {
      await prisma.caller.update({ where: { id: existing.id }, data });
      const portrait = await prisma.callerAsset.findFirst({ where: { callerId: existing.id, type: "PORTRAIT" } });
      if (portrait) await prisma.callerAsset.update({ where: { id: portrait.id }, data: { url: fixture.portrait, label: `${fixture.firstName} portrait` } });
      else await prisma.callerAsset.create({ data: { callerId: existing.id, type: "PORTRAIT", label: `${fixture.firstName} portrait`, url: fixture.portrait } });
      refreshed += 1;
    } else {
      await prisma.caller.create({ data: { ...data, assets: { create: [{ type: "PORTRAIT", label: `${fixture.firstName} portrait`, url: fixture.portrait }] } } });
      created += 1;
    }
  }
  console.log(`Demo pack installed: ${created} created, ${refreshed} refreshed. Existing shows and callers were left untouched.`);
}

main().finally(() => prisma.$disconnect());
