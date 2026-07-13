export type QueueOrderEntry = { id: string };

export function moveQueueEntry<T extends QueueOrderEntry>(items: readonly T[], movingId: string, targetId: string) {
  const from = items.findIndex((item) => item.id === movingId);
  const target = items.findIndex((item) => item.id === targetId);
  if (from < 0 || target < 0 || from === target) return [...items];

  const next = [...items];
  const [moving] = next.splice(from, 1);
  next.splice(target, 0, moving);
  return next;
}
