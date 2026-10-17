import type { Clock, SeedGenerator, SelectionRunRepository } from "../../src/application/ports.js";
import type { Quarter } from "../../src/domain/quarter.js";
import type { SelectionRun } from "../../src/domain/selection-run.js";
import { InMemorySelectionRunRepository } from "../../src/infrastructure/in-memory-selection-run-repository.js";
import { testSeed } from "./fixtures.js";

// A clock the test can move forward, e.g. into the next quarter.
export class FakeClock {
  private current: Date;

  constructor(iso: string) {
    this.current = new Date(iso);
  }

  readonly now: Clock = () => this.current;

  set(iso: string): void {
    this.current = new Date(iso);
  }
}

// Returns valid fixed seeds ("seed-1", "seed-2", ...) and counts how often a seed was requested.
export class CountingSeedGenerator {
  calls = 0;

  readonly next: SeedGenerator = () => {
    this.calls += 1;
    return testSeed(`seed-${String(this.calls)}`);
  };
}

// find() yields once before answering, so two concurrent calls both see "no run yet" and race to save.
export class SlowFindRepository implements SelectionRunRepository {
  constructor(
    readonly inner: InMemorySelectionRunRepository = new InMemorySelectionRunRepository(),
  ) {}

  async find(tenantId: string, quarter: Quarter): Promise<SelectionRun | undefined> {
    await Promise.resolve();
    return this.inner.find(tenantId, quarter);
  }

  saveIfAbsent(run: SelectionRun): Promise<{ run: SelectionRun; created: boolean }> {
    return this.inner.saveIfAbsent(run);
  }
}
