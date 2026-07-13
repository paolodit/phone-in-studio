import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { callerStructuredData, createCallerSnapshot } from "../lib/caller";
import type { CallerFormInput } from "../lib/schemas";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the database.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }) });

type Fixture = Pick<CallerFormInput, "firstName" | "location" | "occupation" | "issueHeadline" | "openingSummary" | "centralWant" | "worldview" | "actualBehaviour" | "comicContradiction" | "speechStyle" | "hiddenTruth" | "escalationBeats" | "suggestedQuestions" | "voiceId"> & { surnameInitial: string; portrait: string };

const fixtures: Fixture[] = [
  { firstName: "Mandy", surnameInitial: "P", location: "Bridgend", occupation: "Accounts assistant", issueHeadline: "My smart fridge has started taking my husband’s side.", openingSummary: "Mandy says the fridge is sabotaging her diet by favouring her husband’s meal plan.", centralWant: "For the host to agree the appliance has picked a side.", worldview: "Household technology should show basic loyalty.", actualBehaviour: "She made her husband the household administrator after repeatedly forgetting the password.", comicContradiction: "She insists the fridge is biased while she gave it the instruction to prioritise her husband.", speechStyle: "Warm Welsh cadence, precise when describing settings, defensive when challenged.", hiddenTruth: "Mandy entered her husband as the administrator and never told him why.", escalationBeats: "The fridge recommends his lunches first.\nMandy admits he is the administrator.\nShe reveals she gave up the password after locking herself out five times.", suggestedQuestions: "Why is he the administrator?\nWhat exact setting did you choose?\nHas the fridge ever actually spoken?", voiceId: "mock-warm-welsh", portrait: "/portraits/mandy.svg" },
  { firstName: "Gareth", surnameInitial: "D", location: "Neath", occupation: "Delivery driver", issueHeadline: "A seagull has learned my lunch schedule and I believe the council is responsible.", openingSummary: "Gareth believes a council seagull has targeted his lunch break with unnerving precision.", centralWant: "For the council to compensate him for a sandwich-related campaign of harassment.", worldview: "Public bodies should control animals with access to public space.", actualBehaviour: "He has trained the bird by staging increasingly theatrical decoy lunches.", comicContradiction: "Each deterrent is actually a more reliable lunch signal.", speechStyle: "Brisk and officious, with unnecessarily technical detail about sandwiches.", hiddenTruth: "Gareth built a timed feeder system to distract the seagull, which now functions as its lunch alarm.", escalationBeats: "The bird appears near his van.\nHe describes the decoy sandwich.\nHe admits the decoy has a timer and a labelled container.", suggestedQuestions: "Why does it know the exact minute?\nWho bought the timer?\nHave you tried not feeding it?", voiceId: "mock-dry-welsh", portrait: "/portraits/gareth.svg" },
  { firstName: "Denise", surnameInitial: "R", location: "Barry", occupation: "Salon owner", issueHeadline: "My daughter has quietly removed me from the family WhatsApp group.", openingSummary: "Denise says she has been exiled from a family group chat for no understandable reason.", centralWant: "For the host to confirm she is the victim of a petty digital coup.", worldview: "A close family should be visibly responsive at all times.", actualBehaviour: "She sends daily rankings of relatives based on response speed.", comicContradiction: "She says she hates drama while publishing a family league table.", speechStyle: "Confident, polished and aggrieved; becomes briskly managerial when challenged.", hiddenTruth: "She created a colour-coded responsiveness spreadsheet and sent it to the family group every morning.", escalationBeats: "She says messages went unanswered.\nA weekly table appears.\nShe admits there were relegation places.", suggestedQuestions: "What was the group called?\nHow often did you publish a table?\nWas there a prize for first place?", voiceId: "mock-confident-welsh", portrait: "/portraits/denise.svg" },
  { firstName: "Colin", surnameInitial: "H", location: "Port Talbot", occupation: "Retired fitter", issueHeadline: "My neighbour’s Ring doorbell is making editorial comments about my appearance.", openingSummary: "Colin says the automated doorbell notifications have become an unnervingly personal critique.", centralWant: "For the host to take a campaign of electronic judgement seriously.", worldview: "Technology should not take sides in neighbour disputes.", actualBehaviour: "He has interpreted routine package notifications as targeted remarks.", comicContradiction: "He finds each neutral sentence more insulting because he is already watching the doorbell.", speechStyle: "Measured and suspicious, with a habit of quoting notifications exactly.", hiddenTruth: "The doorbell only says ordinary delivery messages; Colin has renamed its voice profile ‘the neighbour’.", escalationBeats: "He quotes a delivery alert.\nHe admits changing the voice name.\nHe reveals he walks past it repeatedly to test its tone.", suggestedQuestions: "What did it say word for word?\nWho named the voice?\nHow many times did you test it?", voiceId: "mock-gravel-welsh", portrait: "/portraits/colin.svg" },
  { firstName: "Rhys", surnameInitial: "J", location: "Swansea", occupation: "PE teacher", issueHeadline: "I joined a cold-water swimming group, but they are not taking the cold seriously enough.", openingSummary: "Rhys wants a casual swimming group to introduce penalties, tables and official temperature adjudication.", centralWant: "For the host to recognise a crisis of standards in recreational suffering.", worldview: "Any shared activity becomes fairer when it is measured and ranked.", actualBehaviour: "He turns optional discomfort into a competitive league.", comicContradiction: "He wants everyone to enjoy cold water properly by making it miserable.", speechStyle: "Energetic, competitive and overly procedural.", hiddenTruth: "Rhys brings a clipboard, temperature probe and a draft disciplinary code to every swim.", escalationBeats: "He complains people wear neoprene boots.\nHe proposes a points deduction.\nHe unveils the independent temperature adjudicator, who is his cousin.", suggestedQuestions: "What happens if someone shivers too little?\nWho appointed the adjudicator?\nWhy is there a disciplinary code?", voiceId: "mock-keen-welsh", portrait: "/portraits/rhys.svg" },
];

async function main() {
  await prisma.show.deleteMany();
  await prisma.caller.deleteMany();

  const callers = [];
  for (const fixture of fixtures) {
    const input: CallerFormInput = { ...fixture, age: undefined, relationshipStatus: undefined, portraitUrl: fixture.portrait };
    const structured = callerStructuredData(input);
    const caller = await prisma.caller.create({
      data: {
        firstName: input.firstName, surnameInitial: fixture.surnameInitial, location: input.location, occupation: input.occupation,
        issueHeadline: input.issueHeadline, openingSummary: input.openingSummary, status: "APPROVED", approvedAt: new Date(), approvedBy: "development fixture",
        character: structured.character as Prisma.InputJsonValue, story: structured.story as Prisma.InputJsonValue, performance: structured.performance as Prisma.InputJsonValue, hostSupport: structured.hostSupport as Prisma.InputJsonValue,
        quality: { overall: 0, manuallyApproved: true } as Prisma.InputJsonValue,
        assets: { create: [
          { type: "PORTRAIT", label: `${fixture.firstName} portrait`, url: fixture.portrait },
          { type: "SUPPORTING_VISUAL", label: "The suspicious receipt", url: "/visuals/placeholder.svg", manualHotkey: "1", trigger: "Manual visual test", priority: 1 },
          { type: "SUPPORTING_VISUAL", label: "A highly specific diagram", url: "/visuals/placeholder.svg", manualHotkey: "2", trigger: "Manual visual test", priority: 2 },
          { type: "SUPPORTING_VISUAL", label: "The final reveal", url: "/visuals/placeholder.svg", manualHotkey: "3", trigger: "Manual visual test", priority: 3 },
        ] },
      }, include: { assets: true },
    });
    callers.push(caller);
  }
  const show = await prisma.show.create({ data: { title: "AI Phone-In — Development Show", status: "READY", brandingConfig: { programmeName: "AI Phone-In" } as Prisma.InputJsonValue } });
  await prisma.queueItem.createMany({ data: callers.map((caller, index) => ({ showId: show.id, callerId: caller.id, position: index + 1, callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue })) });
  console.log(`Seeded ${callers.length} callers and the development show.`);
}

main().finally(() => prisma.$disconnect());
