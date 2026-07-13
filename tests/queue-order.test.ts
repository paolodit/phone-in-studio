import { describe, expect, it } from "vitest";
import { moveQueueEntry } from "@/lib/queue-order";

describe("moveQueueEntry", () => {
  it("moves an item before the drop target without losing callers", () => {
    const result = moveQueueEntry([{ id: "mandy" }, { id: "gareth" }, { id: "denise" }], "denise", "gareth");
    expect(result.map((item) => item.id)).toEqual(["mandy", "denise", "gareth"]);
  });

  it("leaves the order intact for invalid moves", () => {
    const items = [{ id: "mandy" }, { id: "gareth" }];
    expect(moveQueueEntry(items, "unknown", "gareth")).toEqual(items);
  });
});
