import { afterEach, describe, expect, it, vi } from "vitest";
import { allocateCallMinutes, planContentSchema, planTiming, showBriefSchema } from "@/lib/show-plan";
import { generateShowPlan, replacePlanSlot } from "@/lib/show-plan-generation";
import { planFixture } from "@/tests/fixtures/show-plan";
describe("Show planner contracts", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("bounds caller count and show length", () => {
    expect(showBriefSchema.parse({ brief: "A gentle phone-in on starting again", durationMinutes: 20 }).count).toBe(4);
    expect(showBriefSchema.safeParse({ brief: "hello", durationMinutes: 20, count: 100 }).success).toBe(false);
  });
  it("leaves two minutes for opening and close", () => {
    expect(allocateCallMinutes(20, 4)).toEqual([5, 5, 4, 4]);
    expect(allocateCallMinutes(15, 6).reduce((a, b) => a + b, 0)).toBe(13);
  });
  it("counts only kept callers and exposes overruns", () => {
    expect(planTiming(planFixture, 20)).toEqual({ count: 1, callerMinutes: 4, remainingMinutes: 16 });
    expect(planTiming({ ...planFixture, slots: planFixture.slots.map((slot) => ({ ...slot, keep: false })) }, 20).count).toBe(0);
    expect(planTiming(planFixture, 3).remainingMinutes).toBe(-1);
  });
  it("rejects duplicate IDs and malformed callers", () => {
    expect(planContentSchema.safeParse({ ...planFixture, slots: [planFixture.slots[0], planFixture.slots[0]] }).success).toBe(false);
    expect(planContentSchema.safeParse({ ...planFixture, slots: [{ ...planFixture.slots[0], draft: {} }] }).success).toBe(false);
  });
  it("requests bounded structured output without provider storage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const { id: _id, keep: _keep, minutes: _minutes, ...slot } = planFixture.slots[0];
    const fetch = vi.fn(async (_url: unknown, _options: RequestInit) => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ title: planFixture.title, synopsis: planFixture.synopsis, slots: Array(4).fill(slot) }) }) }));
    vi.stubGlobal("fetch", fetch);
    const result = await generateShowPlan({ brief: "A warm show about starting over", durationMinutes: 20, count: 4 });
    expect(new Set(result.slots.map((item) => item.id)).size).toBe(4);
    expect(result.slots.map((item) => item.minutes)).toEqual([5, 5, 4, 4]);
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.store).toBe(false); expect(body.text.format.strict).toBe(true);
  });
  it("swaps one card while retaining its ID, selection and timing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key"); const slot = planFixture.slots[0];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ role: "Fresh angle", reasonTonight: slot.reasonTonight, visualIdea: slot.visualIdea, draft: { ...slot.draft, firstName: "Ruth" } }) }) })));
    const result = await replacePlanSlot("Starting over", planFixture, slot.id);
    expect(result.slots[0]).toMatchObject({ id: slot.id, keep: true, minutes: 4, draft: { firstName: "Ruth" } });
    expect(planFixture.slots[0].draft.firstName).toBe("Megan");
  });
});
