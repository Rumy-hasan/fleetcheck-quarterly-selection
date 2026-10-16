import { describe, expect, it } from "vitest";
import { DomainError, InvalidVehicleCountError } from "../../src/domain/errors.js";
import { Percentage } from "../../src/domain/percentage.js";
import { MAX_VEHICLES, MIN_VEHICLES, pickCount } from "../../src/domain/pick-count.js";

interface PickCountCase {
  vehicles: number;
  percent: number;
  expected: number;
  why: string;
}

const cases: PickCountCase[] = [
  { vehicles: 20, percent: 25, expected: 5, why: "exact share" },
  { vehicles: 21, percent: 25, expected: 5, why: "5.25 rounds down" },
  { vehicles: 22, percent: 25, expected: 6, why: "5.5 rounds half up" },
  { vehicles: 23, percent: 25, expected: 6, why: "5.75 rounds up" },
  { vehicles: 5, percent: 10, expected: 1, why: "0.5 rounds half up to 1" },
  { vehicles: 4, percent: 1, expected: 1, why: "0.04 is raised to the minimum of 1" },
  { vehicles: 4, percent: 100, expected: 4, why: "100% picks every vehicle" },
  { vehicles: 10, percent: 100, expected: 10, why: "100% picks every vehicle" },
  { vehicles: 200_000, percent: 25, expected: 50_000, why: "largest fleet" },
  { vehicles: 200_000, percent: 1, expected: 2_000, why: "largest fleet, smallest share" },
];

describe("pickCount", () => {
  it.each(cases)(
    "picks $expected of $vehicles vehicles at $percent% ($why)",
    ({ vehicles, percent, expected }: PickCountCase) => {
      const result: number = pickCount(vehicles, Percentage.of(percent));

      expect(result).toBe(expected);
    },
  );

  it("accepts the smallest and largest allowed fleet", () => {
    const percentage: Percentage = Percentage.of(50);

    expect(pickCount(MIN_VEHICLES, percentage)).toBe(2);
    expect(pickCount(MAX_VEHICLES, percentage)).toBe(100_000);
  });

  it.each([0, 3, 200_001, 4.5, Number.NaN])(
    "rejects a fleet of %s vehicles",
    (vehicles: number) => {
      expect(() => pickCount(vehicles, Percentage.of(25))).toThrow(InvalidVehicleCountError);
    },
  );

  it("names the rejected count in the message and is a DomainError", () => {
    const act = (): number => pickCount(3, Percentage.of(25));

    expect(act).toThrow("vehicle count must be an integer from 4 to 200000, got 3");
    expect(act).toThrow(DomainError);
  });

  it("never picks fewer than 1 or more than the fleet for any allowed input", () => {
    const fleetSizes: number[] = [4, 5, 7, 99, 1_000, 199_999, 200_000];

    for (const vehicles of fleetSizes) {
      for (let percent = 1; percent <= 100; percent++) {
        const result: number = pickCount(vehicles, Percentage.of(percent));

        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(vehicles);
      }
    }
  });
});
