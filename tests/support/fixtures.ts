import { createHash } from "node:crypto";

// A fixed, valid seed (64 lowercase hex chars) derived from a readable label, so tests stay deterministic.
export function testSeed(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

// Ids V0001, V0002, ... in ascending order.
export function vehicleIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `V${String(i + 1).padStart(4, "0")}`);
}

// Deterministic reorder (no Math.random): reverse, then move the first `by` items to the end.
export function reorder(ids: readonly string[], by: number): string[] {
  const reversed = [...ids].reverse();
  return [...reversed.slice(by), ...reversed.slice(0, by)];
}
