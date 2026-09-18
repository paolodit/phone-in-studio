import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { callerFormSchema } from "@/lib/schemas";
import { callerStructuredData, createCallerSnapshot } from "@/lib/caller";
import { buildShowFormatConfig } from "@/lib/show-format";
import { searchStockImages } from "@/lib/stock-images";
import { independentGuestInstructions, starterPackIssue, starterPacks, type PackImage, type StarterPack } from "@/lib/starter-packs";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function preparePackImages(pack: StarterPack) {
  return Promise.all(pack.cast.map(async (guest) => {
    if (guest.imagery.images?.length) return { images: [...guest.imagery.images], missing: false };
    try {
      const result = await searchStockImages(guest.imagery.query || pack.imagery.query, "auto", AbortSignal.timeout(8_000));
      const images: PackImage[] = result.results.slice(0, pack.imagery.imagesPerGuest).map((image) => ({
        url: image.imageUrl, label: image.alt, creditText: `${image.creator} · ${image.provider === "pexels" ? "Pexels" : "Pixabay"}`, creditUrl: image.sourceUrl,
      }));
      return { images, missing: images.length === 0 };
    } catch {
      // A missing stock key or provider outage must not lose the whole channel.
      return { images: [] as PackImage[], missing: true };
    }
  }));
}

/** Copy a trusted local template once. Never link mutable callers to the template. */
export async function createChannel(input: { title: string; mode: string; packId?: string }) {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 120) throw new Error("Channel name must be between 3 and 120 characters.");
  if (input.mode === "custom") {
    return prisma.show.create({ data: { title, brandingConfig: json(buildShowFormatConfig({ title })) } });
  }
  if (input.mode !== "human" && input.mode !== "auto") throw new Error("Choose how you want to create your channel.");
  const pack = starterPacks.find((item) => item.id === input.packId && item.mode === input.mode);
  if (!pack) throw new Error("Choose a starter pack from this menu.");
  const issue = starterPackIssue(pack);
  if (issue) throw new Error(issue);
  const callers = pack.cast.map((guest) => callerFormSchema.parse(guest.caller));
  const prepared = await preparePackImages(pack);
  return prisma.$transaction(async (tx) => {
    let hostProfileId: string | undefined;
    if (pack.mode === "auto" && pack.presenter) {
      const profile = await tx.hostProfile.create({ data: { ...pack.presenter, voiceProvider: "openai", guidance: `${pack.presenter.guidance}\n${pack.instructions}\n${independentGuestInstructions}`, characteristics: json(pack.presenter.characteristics) } });
      hostProfileId = profile.id;
      // Explicitly choosing this route is the opt-in. Never start auto-run here.
      await tx.optionalModuleSetting.upsert({ where: { key: "AI_HOST" }, create: { key: "AI_HOST", enabled: true }, update: { enabled: true } });
    }
    const show = await tx.show.create({ data: {
      title, status: "READY", hostMode: pack.mode === "auto" ? "AI_AUTONOMOUS" : "HUMAN", hostProfileId,
      brandingConfig: json({
        ...buildShowFormatConfig({ title, formatId: pack.formatId, formatGuidance: `${pack.instructions}\n${independentGuestInstructions}`, voiceProvider: pack.defaults.voiceProvider }),
        starterPack: { id: pack.id, version: pack.version, name: pack.name, missingVisuals: prepared.filter((item) => item.missing).length },
        backgroundMusic: pack.defaults.music,
        visualAutoplay: { ...pack.defaults.imageAutoplay, startedAt: 0 },
      }),
      ...(pack.mode === "auto" ? { moduleSettings: { create: { key: "AI_HOST", enabled: true, config: json({ maxTurnsPerCaller: pack.defaults.maxTurnsPerCaller, betweenCallsSeconds: pack.defaults.betweenCallsSeconds, visualPolicy: "AUTO_SHOW", visualAvoidPeople: true }) } } } : {}),
    } });
    for (const [index, form] of callers.entries()) {
      const guest = pack.cast[index];
      const structured = callerStructuredData(form);
      const caller = await tx.caller.create({ data: {
        firstName: form.firstName, surnameInitial: form.surnameInitial, age: form.age, location: form.location,
        occupation: form.occupation, relationshipStatus: form.relationshipStatus, issueHeadline: form.issueHeadline, openingSummary: form.openingSummary,
        character: json(structured.character), story: json(structured.story), performance: json(structured.performance), hostSupport: json(structured.hostSupport),
        status: "APPROVED", approvedAt: new Date(), approvedBy: "starter-pack",
        generation: json({ source: "STARTER_PACK", packId: pack.id, packVersion: pack.version, guestId: guest.id, createdForShowId: show.id, topicTags: form.topicTags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
        assets: { create: [
          { type: "PORTRAIT", ...guest.portrait },
          ...prepared[index].images.map((image, priority) => ({ type: "SUPPORTING_VISUAL", ...image, priority, manualHotkey: String(priority + 1) })),
        ] },
      }, include: { assets: true } });
      await tx.queueItem.create({ data: { showId: show.id, callerId: caller.id, position: index + 1, callerSnapshot: json(createCallerSnapshot(caller)) } });
    }
    return show;
  }, { timeout: 20_000 });
}
