import { describe, expect, it } from "vitest";
import { Percentage } from "../../src/domain/percentage.js";
import { selectVehicles } from "../../src/domain/select-vehicles.js";
import { cryptoSeedGenerator } from "../../src/infrastructure/crypto-seed-generator.js";
import { vehicleIds } from "../support/fixtures.js";

describe("cryptoSeedGenerator", () => {
  it("returns 64 lowercase hex characters (32 random bytes)", () => {
    const seed: string = cryptoSeedGenerator();

    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different seed on each call", () => {
    const seeds: Set<string> = new Set(Array.from({ length: 20 }, () => cryptoSeedGenerator()));

    expect(seeds.size).toBe(20);
  });

  it("produces seeds the selection algorithm accepts", () => {
    const picks: string[] = selectVehicles({
      vehicleIds: vehicleIds(20),
      percentage: Percentage.of(25),
      seed: cryptoSeedGenerator(),
    });

    expect(picks).toHaveLength(5);
  });
});
