import { QuarterNotOpenForDrawError } from "../domain/errors.js";
import { Percentage } from "../domain/percentage.js";
import { Quarter } from "../domain/quarter.js";
import {
  assertValidTenantId,
  createSelectionRun,
  type SelectionRun,
} from "../domain/selection-run.js";
import type { Clock, SeedGenerator, SelectionRunRepository } from "./ports.js";

export interface RunQuarterlySelectionDeps {
  repository: SelectionRunRepository;
  seedGenerator: SeedGenerator;
  clock: Clock;
}

export interface RunQuarterlySelectionInput {
  tenantId: string;
  year: number;
  quarter: number;
  percentage: number;
  activeVehicleIds: readonly string[];
}

export interface RunQuarterlySelectionResult {
  run: SelectionRun;
  reused: boolean;
}

export class RunQuarterlySelection {
  constructor(private readonly deps: RunQuarterlySelectionDeps) {}

  async execute(input: RunQuarterlySelectionInput): Promise<RunQuarterlySelectionResult> {
    const now = this.deps.clock();
    // Cheap checks run on every call, so a caller bug surfaces even on a rerun (docs/decisions.md D11).
    assertValidTenantId(input.tenantId);
    const quarter = Quarter.of(input.year, input.quarter, now);
    const percentage = Percentage.of(input.percentage);

    // Idempotency comes from the stored run: a rerun never draws again, whatever the new input.
    const existing = await this.deps.repository.find(input.tenantId, quarter);
    if (existing !== undefined) {
      return { run: existing, reused: true };
    }

    if (!quarter.isCurrent(now)) {
      throw new QuarterNotOpenForDrawError(
        `${quarter.toString()} has no run and can no longer be drawn; only the current quarter can`,
      );
    }

    const run = createSelectionRun({
      tenantId: input.tenantId,
      quarter,
      percentage,
      seed: this.deps.seedGenerator(),
      eligibleVehicleIds: input.activeVehicleIds,
      createdAt: now,
    });
    // A concurrent call may have saved first; then its run wins and this one is discarded.
    const saved = await this.deps.repository.saveIfAbsent(run);
    return { run: saved.run, reused: !saved.created };
  }
}
