import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { callerStructuredData, createCallerSnapshot } from "../lib/caller";
import { demoCallerFixtures } from "../lib/demo-callers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the database.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }) });

async function main() {
  await prisma.show.deleteMany();
  await prisma.caller.deleteMany();

  const callers = [];
  for (const fixture of demoCallerFixtures) {
    const structured = callerStructuredData(fixture);
    const caller = await prisma.caller.create({
      data: {
        firstName: fixture.firstName,
        surnameInitial: fixture.surnameInitial,
        age: fixture.age,
        location: fixture.location,
        occupation: fixture.occupation,
        relationshipStatus: fixture.relationshipStatus,
        issueHeadline: fixture.issueHeadline,
        openingSummary: fixture.openingSummary,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: "demo pack",
        character: structured.character as Prisma.InputJsonValue,
        story: structured.story as Prisma.InputJsonValue,
        performance: structured.performance as Prisma.InputJsonValue,
        hostSupport: structured.hostSupport as Prisma.InputJsonValue,
        generation: { source: "DEMO_PACK", fixtureId: fixture.fixtureId, topicTags: fixture.topicTags.split(",").map((tag) => tag.trim()), callMode: fixture.callMode, emotionalTemperature: fixture.emotionalTemperature } as Prisma.InputJsonValue,
        quality: { overall: 100, manuallyApproved: true } as Prisma.InputJsonValue,
        assets: { create: [{ type: "PORTRAIT", label: `${fixture.firstName} portrait`, url: fixture.portrait }] },
      },
      include: { assets: true },
    });
    callers.push(caller);
  }

  const show = await prisma.show.create({ data: { title: "AI Phone-In — Development Show", status: "READY", brandingConfig: { programmeName: "AI Phone-In" } as Prisma.InputJsonValue } });
  await prisma.queueItem.createMany({ data: callers.map((caller, index) => ({ showId: show.id, callerId: caller.id, position: index + 1, callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue })) });
  console.log(`Seeded ${callers.length} varied demo callers and the development show.`);
}

main().finally(() => prisma.$disconnect());
