import { describe, expect, it } from "vitest";
import {
  DuplicateVehicleError,
  InvalidSeedError,
  InvalidVehicleCountError,
  InvalidVehicleIdError,
} from "../../src/domain/errors.js";
import { Percentage } from "../../src/domain/percentage.js";
import { ALGORITHM_VERSION, selectVehicles } from "../../src/domain/select-vehicles.js";
import { reorder, testSeed, vehicleIds } from "../support/fixtures.js";

const SEED: string = testSeed("select-vehicles");

function select(ids: readonly string[], percent: number, seed: string = SEED): string[] {
  return selectVehicles({ vehicleIds: ids, percentage: Percentage.of(percent), seed });
}

describe("selectVehicles", () => {
  it("returns the same picks for the same inputs", () => {
    const ids: string[] = vehicleIds(20);

    expect(select(ids, 25)).toEqual(select(ids, 25));
  });

  it.each([1, 7, 13])(
    "returns the same picks when the input order changes (shift %i)",
    (by: number) => {
      const ids: string[] = vehicleIds(50);

      expect(select(reorder(ids, by), 25)).toEqual(select(ids, 25));
    },
  );

  it.each([
    [20, 25, 5],
    [21, 25, 5],
    [22, 25, 6],
    [4, 1, 1],
  ])(
    "%i vehicles at %i percent give exactly %i picks",
    (count: number, percent: number, expected: number) => {
      expect(select(vehicleIds(count), percent)).toHaveLength(expected);
    },
  );

  it("returns a subset of the input, sorted ascending, without duplicates", () => {
    const ids: string[] = vehicleIds(100);

    const picks: string[] = select(reorder(ids, 3), 30);

    expect(picks.every((id: string) => ids.includes(id))).toBe(true);
    expect(new Set(picks).size).toBe(picks.length);
    expect(picks).toEqual([...picks].sort());
  });

  it("picks every vehicle at 100%", () => {
    const ids: string[] = vehicleIds(12);

    expect(select(reorder(ids, 5), 100)).toEqual(ids);
  });

  it("gives different picks for different seeds", () => {
    const ids: string[] = vehicleIds(100);

    expect(select(ids, 25, testSeed("a"))).not.toEqual(select(ids, 25, testSeed("b")));
  });

  it("keeps lower-percentage picks inside higher-percentage picks for the same seed", () => {
    const ids: string[] = vehicleIds(100);

    const small: string[] = select(ids, 10);
    const large: string[] = select(ids, 40);

    expect(small.every((id: string) => large.includes(id))).toBe(true);
  });

  it("does not modify the caller's list", () => {
    const ids: string[] = reorder(vehicleIds(20), 4);
    const before: string[] = [...ids];

    select(ids, 25);

    expect(ids).toEqual(before);
  });

  it.each([
    ["too short", "abc"],
    ["63 characters", "a".repeat(63)],
    ["65 characters", "a".repeat(65)],
    ["uppercase", "A".repeat(64)],
    ["not hex", "g".repeat(64)],
    ["empty", ""],
  ])("rejects a seed that is %s", (_reason: string, seed: string) => {
    expect(() => select(vehicleIds(20), 25, seed)).toThrow(InvalidSeedError);
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("rejects a vehicle id that is %s", (_reason: string, badId: string) => {
    const ids: string[] = [...vehicleIds(10), badId];

    expect(() => select(ids, 25)).toThrow(InvalidVehicleIdError);
  });

  it("rejects duplicate vehicle ids and names the duplicate", () => {
    const ids: string[] = [...vehicleIds(10), "V0007"];

    expect(() => select(ids, 25)).toThrow(DuplicateVehicleError);
    expect(() => select(ids, 25)).toThrow("Duplicate vehicle id: V0007");
  });

  it.each([0, 3, 200_001])("rejects a fleet of %i vehicles", (count: number) => {
    expect(() => select(vehicleIds(count), 25)).toThrow(InvalidVehicleCountError);
  });

  it("exposes the algorithm version stored with every run", () => {
    expect(ALGORITHM_VERSION).toBe("hmac-sha256-lowest-k/v1");
  });
});
