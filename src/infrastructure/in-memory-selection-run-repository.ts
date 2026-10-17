import type { SelectionRunRepository } from "../application/ports.js";
import type { Quarter } from "../domain/quarter.js";
import type { SelectionRun } from "../domain/selection-run.js";

export class InMemorySelectionRunRepository implements SelectionRunRepository {
  private readonly runs = new Map<string, SelectionRun>();

  find(tenantId: string, quarter: Quarter): Promise<SelectionRun | undefined> {
    return Promise.resolve(this.runs.get(key(tenantId, quarter)));
  }

  // Check and set with no await in between, so no other call can interleave: atomic in Node.
  // Postgres: INSERT ... ON CONFLICT (tenant_id, year, quarter) DO NOTHING, then SELECT the stored row.
  saveIfAbsent(run: SelectionRun): Promise<{ run: SelectionRun; created: boolean }> {
    const runKey = key(run.tenantId, run.quarter);
    const existing = this.runs.get(runKey);
    if (existing !== undefined) {
      return Promise.resolve({ run: existing, created: false });
    }
    this.runs.set(runKey, run);
    return Promise.resolve({ run, created: true });
  }

  // For tests and the demo: how many runs are stored.
  get size(): number {
    return this.runs.size;
  }
}

// JSON gives an unambiguous key for any tenant id, without reasoning about separator characters.
function key(tenantId: string, quarter: Quarter): string {
  return JSON.stringify([tenantId, quarter.year, quarter.quarter]);
}
