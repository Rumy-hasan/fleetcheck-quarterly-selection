import { DomainError, InvalidTenantIdError, UnsupportedAlgorithmVersionError } from "./errors.js";
import { Percentage } from "./percentage.js";
import type { Quarter } from "./quarter.js";
import { ALGORITHM_VERSION, selectVehicles } from "./select-vehicles.js";

// The stored result of one draw: everything an auditor needs to reproduce it.
export interface SelectionRun {
  readonly tenantId: string;
  readonly quarter: Quarter;
  readonly percentage: number;
  readonly seed: string;
  readonly algorithmVersion: string;
  readonly eligibleVehicleIds: readonly string[];
  readonly pickedVehicleIds: readonly string[];
  readonly createdAt: Date;
}

export interface CreateSelectionRunInput {
  tenantId: string;
  quarter: Quarter;
  percentage: Percentage;
  seed: string;
  eligibleVehicleIds: readonly string[];
  createdAt: Date;
}

// Seed and createdAt come from the caller, so this stays pure and testable.
export function createSelectionRun(input: CreateSelectionRunInput): SelectionRun {
  if (input.tenantId.trim() === "") {
    throw new InvalidTenantIdError("tenant id must not be empty");
  }
  const pickedVehicleIds = selectVehicles({
    vehicleIds: input.eligibleVehicleIds,
    percentage: input.percentage,
    seed: input.seed,
  });
  return {
    tenantId: input.tenantId,
    quarter: input.quarter,
    percentage: input.percentage.value,
    seed: input.seed,
    algorithmVersion: ALGORITHM_VERSION,
    // Default sort is code-unit order, the same order selectVehicles uses for the picks.
    eligibleVehicleIds: [...input.eligibleVehicleIds].sort(),
    pickedVehicleIds,
    createdAt: input.createdAt,
  };
}

// Auditor check: recompute the picks from the stored inputs and compare (docs/decisions.md D9).
export function verifyRun(run: SelectionRun): boolean {
  if (run.algorithmVersion !== ALGORITHM_VERSION) {
    throw new UnsupportedAlgorithmVersionError(run.algorithmVersion);
  }
  let expected: string[];
  try {
    expected = selectVehicles({
      vehicleIds: run.eligibleVehicleIds,
      percentage: Percentage.of(run.percentage),
      seed: run.seed,
    });
  } catch (error: unknown) {
    // Stored data that breaks a rule (e.g. an edited seed) simply does not verify.
    if (error instanceof DomainError) return false;
    throw error;
  }
  return sameIds(expected, run.pickedVehicleIds);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
