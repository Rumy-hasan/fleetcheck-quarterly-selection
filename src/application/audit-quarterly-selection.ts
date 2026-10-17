import { SelectionRunNotFoundError } from "../domain/errors.js";
import { Quarter } from "../domain/quarter.js";
import { assertValidTenantId, verifyRun, type SelectionRun } from "../domain/selection-run.js";
import type { Clock, SelectionRunRepository } from "./ports.js";

export interface AuditQuarterlySelectionDeps {
  repository: SelectionRunRepository;
  clock: Clock;
}

export interface AuditQuarterlySelectionInput {
  tenantId: string;
  year: number;
  quarter: number;
}

export interface AuditQuarterlySelectionResult {
  run: SelectionRun;
  verified: boolean;
}

// Read-only: an audit must never create the evidence it checks (docs/decisions.md D13).
export class AuditQuarterlySelection {
  constructor(private readonly deps: AuditQuarterlySelectionDeps) {}

  async execute(input: AuditQuarterlySelectionInput): Promise<AuditQuarterlySelectionResult> {
    assertValidTenantId(input.tenantId);
    const quarter = Quarter.of(input.year, input.quarter, this.deps.clock());

    const run = await this.deps.repository.find(input.tenantId, quarter);
    if (run === undefined) {
      throw new SelectionRunNotFoundError(
        `no selection run for tenant ${input.tenantId} in ${quarter.toString()}`,
      );
    }
    return { run, verified: verifyRun(run) };
  }
}
