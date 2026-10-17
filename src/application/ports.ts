import type { Quarter } from "../domain/quarter.js";
import type { SelectionRun } from "../domain/selection-run.js";

export interface SelectionRunRepository {
  find(tenantId: string, quarter: Quarter): Promise<SelectionRun | undefined>;
  // Must be atomic: of two concurrent saves for the same tenant and quarter, exactly one is created.
  saveIfAbsent(run: SelectionRun): Promise<{ run: SelectionRun; created: boolean }>;
}

// Returns a fresh secret seed: 64 lowercase hex characters.
export type SeedGenerator = () => string;

export type Clock = () => Date;
