import { InvalidVehicleCountError } from "./errors.js";
import type { Percentage } from "./percentage.js";

// Fleet size limits, see docs/decisions.md D4.
export const MIN_VEHICLES = 4;
export const MAX_VEHICLES = 200_000;

// How many vehicles to inspect: round half up, at least one (docs/decisions.md D5).
export function pickCount(vehicleCount: number, percentage: Percentage): number {
  if (
    !Number.isInteger(vehicleCount) ||
    vehicleCount < MIN_VEHICLES ||
    vehicleCount > MAX_VEHICLES
  ) {
    throw new InvalidVehicleCountError(
      `vehicle count must be an integer from ${String(MIN_VEHICLES)} to ${String(MAX_VEHICLES)}, got ${String(vehicleCount)}`,
    );
  }
  // Integer maths only: n * p is at most 2e7, so +50 then floor is an exact round-half-up.
  const rounded = Math.floor((vehicleCount * percentage.value + 50) / 100);
  return Math.max(1, rounded);
}
