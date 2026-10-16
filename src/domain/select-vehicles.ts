import { createHmac } from "node:crypto";
import { DuplicateVehicleError, InvalidSeedError, InvalidVehicleIdError } from "./errors.js";
import type { Percentage } from "./percentage.js";
import { pickCount } from "./pick-count.js";

// Stored with every run so an old run can still be verified if this algorithm changes.
export const ALGORITHM_VERSION = "hmac-sha256-lowest-k/v1";

// 32 random bytes as lowercase hex: one canonical form, so an auditor cannot use a different key by accident.
const SEED_FORMAT = /^[0-9a-f]{64}$/;

export interface SelectVehiclesInput {
  vehicleIds: readonly string[];
  percentage: Percentage;
  seed: string;
}

interface ScoredVehicle {
  id: string;
  score: string;
}

// Picks the k vehicles with the lowest HMAC score. Every k-subset is equally likely (docs/decisions.md).
export function selectVehicles({ vehicleIds, percentage, seed }: SelectVehiclesInput): string[] {
  if (!SEED_FORMAT.test(seed)) {
    throw new InvalidSeedError("seed must be 64 lowercase hex characters");
  }
  assertValidIds(vehicleIds);
  const k = pickCount(vehicleIds.length, percentage);

  // Hash each vehicle once, then sort once: O(n log n) overall.
  const scored: ScoredVehicle[] = vehicleIds.map((id) => ({ id, score: score(seed, id) }));
  scored.sort(byScoreThenId);

  return scored
    .slice(0, k)
    .map((vehicle) => vehicle.id)
    .sort(compareStrings);
}

function score(seed: string, vehicleId: string): string {
  // The hex seed string itself is the key, so `node -e` with the stored seed reproduces it.
  return createHmac("sha256", seed).update(vehicleId).digest("hex");
}

function assertValidIds(vehicleIds: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of vehicleIds) {
    if (id.trim() === "") {
      throw new InvalidVehicleIdError("vehicle id must not be empty");
    }
    if (seen.has(id)) {
      throw new DuplicateVehicleError(id);
    }
    seen.add(id);
  }
}

function byScoreThenId(a: ScoredVehicle, b: ScoredVehicle): number {
  return compareStrings(a.score, b.score) || compareStrings(a.id, b.id);
}

// Code-unit order, not localeCompare: the result must not depend on the machine's locale.
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
