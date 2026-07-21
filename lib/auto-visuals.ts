import type { GeneratedCallerDraft } from "@/lib/schemas";
import { automatedVisualPackSchema } from "@/lib/schemas";
import { searchStockImages, type StockImageResult } from "@/lib/stock-images";

export type AutomatedVisualPolicy = "OFF" | "PREPARE" | "AUTO_SHOW";

const peopleTerms = /\b(person|people|man|men|woman|women|boy|girl|child|children|face|portrait|couple|family|crowd)\b/i;

export function readAutomatedVisualConfig(config: Record<string, unknown>, hostMode?: string) {
  const fallback: AutomatedVisualPolicy = hostMode === "AI_AUTONOMOUS" ? "AUTO_SHOW" : "OFF";
  const raw = String(config.visualPolicy ?? fallback);
  return {
    policy: (["OFF", "PREPARE", "AUTO_SHOW"].includes(raw) ? raw : fallback) as AutomatedVisualPolicy,
    avoidPeople: config.visualAvoidPeople !== false,
  };
}

export function buildAutomatedVisualQuery(draft: Pick<GeneratedCallerDraft, "topicTags" | "issueHeadline">, avoidPeople: boolean) {
  const tags = draft.topicTags.slice(0, 4).join(" ");
  const base = `${tags} ${draft.issueHeadline}`.replace(/[^a-zA-Z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
  return `${base}${avoidPeople ? " objects place still life no people" : ""}`.slice(0, 100);
}

function withoutPeople(results: StockImageResult[], avoidPeople: boolean) {
  if (!avoidPeople) return results;
  const filtered = results.filter((image) => !peopleTerms.test(image.alt));
  return filtered.length ? filtered : results;
}

export async function prepareAutomatedVisuals(
  draft: Pick<GeneratedCallerDraft, "topicTags" | "issueHeadline">,
  options: { policy: AutomatedVisualPolicy; avoidPeople: boolean },
) {
  const query = buildAutomatedVisualQuery(draft, options.avoidPeople);
  if (options.policy === "OFF") return automatedVisualPackSchema.parse({ status: "SKIPPED", query, items: [] });
  try {
    const { results } = await searchStockImages(query, "auto");
    const items = withoutPeople(results, options.avoidPeople).slice(0, 3);
    if (!items.length) return automatedVisualPackSchema.parse({ status: "FAILED", query, items: [], error: "No suitable stock images were found." });
    return automatedVisualPackSchema.parse({ status: "READY", query, items });
  } catch (error) {
    return automatedVisualPackSchema.parse({
      status: "FAILED",
      query,
      items: [],
      error: error instanceof Error ? error.message.slice(0, 500) : "Stock image preparation failed.",
    });
  }
}
