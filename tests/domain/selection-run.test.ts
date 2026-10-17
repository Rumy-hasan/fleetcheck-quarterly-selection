import { describe, expect, it } from "vitest";
import { InvalidTenantIdError, UnsupportedAlgorithmVersionError } from "../../src/domain/errors.js";
import { Percentage } from "../../src/domain/percentage.js";
import { Quarter } from "../../src/domain/quarter.js";
import { ALGORITHM_VERSION } from "../../src/domain/select-vehicles.js";
import {
  createSelectionRun,
  verifyRun,
  type CreateSelectionRunInput,
  type SelectionRun,
} from "../../src/domain/selection-run.js";
import { reorder, testSeed, vehicleIds } from "../support/fixtures.js";

const NOW: Date = new Date("2026-10-17T09:00:00Z");

// 8 vehicles at 25% pick 2; with 7 left it still picks 2, so removing one vehicle never changes k.
function input(overrides: Partial<CreateSelectionRunInput> = {}): CreateSelectionRunInput {
  return {
    tenantId: "tenant-a",
    quarter: Quarter.of(2026, 3, NOW),
    percentage: Percentage.of(25),
    seed: testSeed("selection-run"),
    eligibleVehicleIds: reorder(vehicleIds(8), 3),
    createdAt: NOW,
    ...overrides,
  };
}

function notPicked(run: SelectionRun): string {
  const id: string | undefined = run.eligibleVehicleIds.find(
    (candidate: string) => !run.pickedVehicleIds.includes(candidate),
  );
  if (id === undefined) throw new Error("fixture must leave at least one vehicle unpicked");
  return id;
}

function without(ids: readonly string[], removed: string): string[] {
  return ids.filter((id: string) => id !== removed);
}

describe("createSelectionRun", () => {
  it("stores every input needed to reproduce the draw, with ids sorted", () => {
    const run: SelectionRun = createSelectionRun(input());

    expect(run.tenantId).toBe("tenant-a");
    expect(run.quarter).toEqual(Quarter.of(2026, 3, NOW));
    expect(run.percentage).toBe(25);
    expect(run.seed).toBe(testSeed("selection-run"));
    expect(run.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(run.eligibleVehicleIds).toEqual(vehicleIds(8));
    expect(run.pickedVehicleIds).toHaveLength(2);
    expect(run.pickedVehicleIds).toEqual([...run.pickedVehicleIds].sort());
  });

  it("keeps the createdAt passed in instead of reading the clock", () => {
    const createdAt: Date = new Date("2026-07-01T00:00:00Z");

    const run: SelectionRun = createSelectionRun(input({ createdAt }));

    expect(run.createdAt).toBe(createdAt);
  });

  it.each(["", "   "])("rejects the blank tenant id %j", (tenantId: string) => {
    expect(() => createSelectionRun(input({ tenantId }))).toThrow(InvalidTenantIdError);
  });
});

describe("verifyRun", () => {
  it("returns true for a fresh run", () => {
    const run: SelectionRun = createSelectionRun(input());

    expect(verifyRun(run)).toBe(true);
  });

  it("returns false when the stored picks are changed", () => {
    const run: SelectionRun = createSelectionRun(input());
    const forged: string[] = [notPicked(run), ...run.pickedVehicleIds.slice(1)].sort();

    expect(verifyRun({ ...run, pickedVehicleIds: forged })).toBe(false);
  });

  it("returns false when the seed is swapped for another valid seed", () => {
    const run: SelectionRun = createSelectionRun(input());

    expect(verifyRun({ ...run, seed: testSeed("another seed") })).toBe(false);
  });

  it("returns false when the stored seed is malformed", () => {
    const run: SelectionRun = createSelectionRun(input());

    expect(verifyRun({ ...run, seed: "xyz" })).toBe(false);
  });

  it("returns false when a picked vehicle is removed from the eligible list", () => {
    const run: SelectionRun = createSelectionRun(input());
    const picked: string = run.pickedVehicleIds[0] ?? "";

    expect(verifyRun({ ...run, eligibleVehicleIds: without(run.eligibleVehicleIds, picked) })).toBe(
      false,
    );
  });

  // Known limit (docs/decisions.md D9): verification proves consistency, not that the inputs are original.
  it("still returns true when a vehicle that was not picked is removed", () => {
    const run: SelectionRun = createSelectionRun(input());
    const eligibleVehicleIds: string[] = without(run.eligibleVehicleIds, notPicked(run));

    expect(verifyRun({ ...run, eligibleVehicleIds })).toBe(true);
  });

  it("rethrows unexpected errors instead of hiding them as false", () => {
    const run: SelectionRun = createSelectionRun(input());
    // Simulates corrupt storage: a non-string id makes selectVehicles fail with a TypeError.
    const corrupt: string[] = [42 as unknown as string, ...run.eligibleVehicleIds];

    expect(() => verifyRun({ ...run, eligibleVehicleIds: corrupt })).toThrow(TypeError);
  });

  it("throws for an unknown algorithm version instead of guessing", () => {
    const run: SelectionRun = createSelectionRun(input());

    expect(() => verifyRun({ ...run, algorithmVersion: "md5-lowest-k/v0" })).toThrow(
      UnsupportedAlgorithmVersionError,
    );
  });
});
