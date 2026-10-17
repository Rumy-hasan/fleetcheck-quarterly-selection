import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RunQuarterlySelection } from "../src/application/run-quarterly-selection.js";
import { Percentage } from "../src/domain/percentage.js";
import { selectVehicles } from "../src/domain/select-vehicles.js";
import { InMemorySelectionRunRepository } from "../src/infrastructure/in-memory-selection-run-repository.js";
import { reorder, testSeed } from "./support/fixtures.js";
import { CountingSeedGenerator, FakeClock } from "./support/fakes.js";

const FLEET_SIZE = 200_000;

// Deterministic UUID-shaped ids (no randomUUID), so this test is repeatable.
function uuidLike(i: number): string {
  const h: string = createHash("sha256").update(String(i)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const FLEET: string[] = Array.from({ length: FLEET_SIZE }, (_, i) => uuidLike(i));

describe("selection at 200,000 vehicles", () => {
  it("picks exactly 50,000 sorted, unique ids at 25% within the time bound", () => {
    const start: number = performance.now();

    const picks: string[] = selectVehicles({
      vehicleIds: FLEET,
      percentage: Percentage.of(25),
      seed: testSeed("scale"),
    });

    const elapsedMs: number = performance.now() - start;
    console.info(`selectVehicles with ${String(FLEET_SIZE)} vehicles: ${elapsedMs.toFixed(0)} ms`);
    expect(picks).toHaveLength(50_000);
    expect(new Set(picks).size).toBe(50_000);
    expect(picks).toEqual([...picks].sort());
    // Generous bound (docs/decisions.md D14): catches an accidental O(n²), not normal machine noise.
    expect(elapsedMs).toBeLessThan(5000);
  });

  it("returns the same picks when the 200,000 ids arrive in a different order", () => {
    const input = { percentage: Percentage.of(25), seed: testSeed("scale") };

    const original: string[] = selectVehicles({ ...input, vehicleIds: FLEET });
    const reordered: string[] = selectVehicles({ ...input, vehicleIds: reorder(FLEET, 12_345) });

    expect(reordered).toEqual(original);
  });

  it("stores one run and reuses it on the second call", async () => {
    const repository = new InMemorySelectionRunRepository();
    const clock = new FakeClock("2026-10-17T09:00:00Z");
    const seeds = new CountingSeedGenerator();
    const useCase = new RunQuarterlySelection({
      repository,
      seedGenerator: seeds.next,
      clock: clock.now,
    });
    const input = { tenantId: "big-fleet", year: 2026, quarter: 4, percentage: 25 };

    const first = await useCase.execute({ ...input, activeVehicleIds: FLEET });
    const second = await useCase.execute({ ...input, activeVehicleIds: FLEET });

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.run.pickedVehicleIds).toEqual(first.run.pickedVehicleIds);
    expect(repository.size).toBe(1);
  });
});
