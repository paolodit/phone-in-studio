import { demoCallerFixtures } from "@/lib/demo-callers";
import { starterPacks, type StarterPack } from "@/lib/starter-packs";

// Test-only cast, never offered as a product starter pack.
export function readyTestPack(mode: "human" | "auto" = "human"): StarterPack {
  const source = starterPacks[0];
  return {
    ...structuredClone(source), id: `test-${mode}`, mode, name: "Isolated starter verification", editorialStatus: "ready",
    expectedGuests: mode === "auto" ? 5 : 6,
    cast: demoCallerFixtures.slice(0, mode === "auto" ? 5 : 6).map((fixture) => ({
      id: fixture.fixtureId, caller: { ...fixture, portraitUrl: undefined },
      portrait: { url: fixture.portrait, label: `${fixture.firstName} portrait` },
      imagery: { query: fixture.topicTags, images: [{ url: "/portraits/aisha.svg", label: "Test-only visual", creditText: "Test fixture" }] },
    })),
    ...(mode === "auto" ? { presenter: { name: "Test Presenter", publicIdentity: "Isolated test presenter", voiceId: "nova", stylePreset: "gentle", guidance: "Ask one question at a time.", boundaries: "Stay in the test.", characteristics: { warmth: 0, energy: 0, patience: 0, playfulness: 0 } } } : {}),
  };
}
