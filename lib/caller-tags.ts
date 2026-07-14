export function callerTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
}

export function parseCallerTags(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
}

export function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
